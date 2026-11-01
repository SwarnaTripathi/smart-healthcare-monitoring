const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Report = require('../models/Report');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');
const { auth, authorize } = require('../middleware/auth');
const { analyzeReport } = require('../utils/reportAnalyzer');

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Multer config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, uniqueName);
  }
});

// M-9: Fixed file filter — reject with an error (not silently pass false)
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const ALLOWED_EXTS = /\.(pdf|jpg|jpeg|png|doc|docx)$/i;

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const extOk  = ALLOWED_EXTS.test(path.extname(file.originalname));
    const mimeOk = ALLOWED_MIMES.has(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX'));
    }
  }
});

// ── Role-based patient-access helper ─────────────────────────────────────────
// H-4: Returns the patientId(s) this user is allowed to access
async function _getAllowedPatientIds(user) {
  if (user.role === 'admin') return null;  // null = unrestricted
  if (user.role === 'doctor') {
    const patients = await Patient.find({ assignedDoctor: user._id }).select('patientId');
    return patients.map(p => p.patientId);
  }
  // patient role
  const record = await Patient.findOne({ user: user._id });
  if (record) return [record.patientId];
  // fallback: match by name
  const byName = await Patient.findOne({ name: { $regex: new RegExp(`^${user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  return byName ? [byName.patientId] : [];
}

// ── POST /api/reports — Upload a report ───────────────────────────────────────
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { patientId, title, type, description, labValues } = req.body;
    if (!patientId || !title) return res.status(400).json({ error: 'patientId and title are required' });

    // H-4: Ensure requesting user is allowed to upload to this patient
    const allowed = await _getAllowedPatientIds(req.user);
    if (allowed !== null && !allowed.includes(patientId)) {
      fs.unlinkSync(req.file.path); // remove orphaned file
      return res.status(403).json({ error: 'Access denied. You cannot upload reports for this patient.' });
    }

    const patient = await Patient.findOne({ patientId });

    let parsedLabValues = null;
    let aiAnalysis = null;
    if (labValues) {
      try {
        parsedLabValues = typeof labValues === 'string' ? JSON.parse(labValues) : labValues;
        const cleaned = {};
        for (const [k, v] of Object.entries(parsedLabValues)) {
          if (v !== '' && v !== null && v !== undefined) cleaned[k] = parseFloat(v);
        }
        if (Object.keys(cleaned).length > 0) {
          parsedLabValues = cleaned;
          aiAnalysis = analyzeReport(cleaned, patient?.gender || 'Male');
        } else {
          parsedLabValues = null;
        }
      } catch (e) { parsedLabValues = null; }
    }

    const report = new Report({
      patientId,
      patientName: patient?.name || '',
      uploadedBy: req.user._id,
      title,
      type: type || 'lab_report',
      description: description || '',
      fileName: req.file.originalname,
      filePath: req.file.filename,   // stored filename only (not full path)
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      labValues: parsedLabValues,
      aiAnalysis
    });
    await report.save();

    // M-5: Audit report upload
    await AuditLog.create({
      action: `Report uploaded: "${title}" for patient ${patientId}`,
      category: 'report',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'info'
    });

    res.status(201).json({ message: 'Report uploaded', report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload report.' });
  }
});

// ── POST /api/reports/:id/analyze — Re-analyze lab values (G13: doctor/admin only) ──
router.post('/:id/analyze', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // H-4: ownership check
    const allowed = await _getAllowedPatientIds(req.user);
    if (allowed !== null && !allowed.includes(report.patientId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { labValues } = req.body;
    if (!labValues || Object.keys(labValues).length === 0) {
      return res.status(400).json({ error: 'Lab values are required for analysis' });
    }

    const patient = await Patient.findOne({ patientId: report.patientId });
    const cleaned = {};
    for (const [k, v] of Object.entries(labValues)) {
      if (v !== '' && v !== null && v !== undefined) cleaned[k] = parseFloat(v);
    }

    const analysis = analyzeReport(cleaned, patient?.gender || 'Male');
    report.labValues = cleaned;
    report.aiAnalysis = analysis;
    await report.save();

    res.json({ message: 'Analysis complete', report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to run analysis.' });
  }
});


// ── GET /api/reports/:patientId — Get reports for a patient ──────────────────
// H-4: Role filter applied
router.get('/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;

    const allowed = await _getAllowedPatientIds(req.user);
    if (allowed !== null && !allowed.includes(patientId)) {
      return res.status(403).json({ error: 'Access denied. You cannot view reports for this patient.' });
    }

    const reports = await Report.find({ patientId })
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/reports/download/:filename — Download a report file ──────────────
// H-3: Ownership check  H-6: Path traversal prevention
router.get('/download/:filename', auth, async (req, res) => {
  try {
    // H-6: Strip any directory components from the filename
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, safeFilename);

    // H-6: Verify the resolved path is still inside uploadDir
    if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // H-3: Verify the report record exists and this user is allowed to access it
    const report = await Report.findOne({ filePath: safeFilename });
    if (!report) return res.status(404).json({ error: 'File not found' });

    const allowed = await _getAllowedPatientIds(req.user);
    if (allowed !== null && !allowed.includes(report.patientId)) {
      return res.status(403).json({ error: 'Access denied. You cannot download this report.' });
    }

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.download(filePath, report.fileName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/reports/:id ───────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // H-4: Ownership check before delete
    const allowed = await _getAllowedPatientIds(req.user);
    if (allowed !== null && !allowed.includes(report.patientId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const filePath = path.join(uploadDir, path.basename(report.filePath));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await Report.findByIdAndDelete(req.params.id);

    // M-5: Audit report deletion
    await AuditLog.create({
      action: `Report deleted: "${report.title}" for patient ${report.patientId}`,
      category: 'report',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'warning'
    });

    res.json({ message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Multer error handler ──────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.startsWith('Invalid file')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
