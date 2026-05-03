const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Report = require('../models/Report');
const Patient = require('../models/Patient');
const { auth } = require('../middleware/auth');
const { analyzeReport } = require('../utils/reportAnalyzer');

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E6)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png|doc|docx/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype === 'application/msword' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    cb(null, ext || mime);
  }
});

// POST /api/reports - Upload a report (with optional lab values for AI analysis)
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { patientId, title, type, description, labValues } = req.body;
    if (!patientId || !title) return res.status(400).json({ error: 'patientId and title are required' });

    const patient = await Patient.findOne({ patientId });

    // Parse lab values if provided
    let parsedLabValues = null;
    let aiAnalysis = null;
    if (labValues) {
      try {
        parsedLabValues = typeof labValues === 'string' ? JSON.parse(labValues) : labValues;
        // Filter out empty values
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
      filePath: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      labValues: parsedLabValues,
      aiAnalysis: aiAnalysis
    });
    await report.save();
    res.status(201).json({ message: 'Report uploaded', report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reports/:id/analyze - Re-analyze or add lab values to existing report
router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

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
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/:patientId - Get reports for a patient
router.get('/:patientId', auth, async (req, res) => {
  try {
    const reports = await Report.find({ patientId: req.params.patientId })
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/download/:filename - Download a report file
router.get('/download/:filename', auth, async (req, res) => {
  try {
    const filePath = path.join(uploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/reports/:id - Delete a report
router.delete('/:id', auth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    // Delete the file
    const filePath = path.join(uploadDir, report.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
