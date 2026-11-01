const express = require('express');
const fs = require('fs');
const path = require('path');
const Patient = require('../models/Patient');
const User = require('../models/User');
const HealthData = require('../models/HealthData');
const Alert = require('../models/Alert');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Allowed update fields (H-5: prevent mass-assignment) ─────────────────────
const PATIENT_UPDATABLE_FIELDS = [
  'name', 'age', 'gender', 'bloodGroup', 'phone', 'address',
  'emergencyContact', 'medicalHistory', 'assignedDoctor', 'status', 'deviceId'
];

// ── Validation ────────────────────────────────────────────────────────────────
const patientCreateValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('age').isInt({ min: 0, max: 150 }).withMessage('Age must be 0–150'),
  body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
];

// GET /api/patients/unlinked-users
router.get('/unlinked-users', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const patientUsers = await User.find({ role: 'patient', isActive: true }).select('-password').sort({ createdAt: -1 });
    const linkedUserIds = await Patient.distinct('user', { user: { $ne: null } });
    const linkedSet = new Set(linkedUserIds.map(id => id.toString()));
    const unlinked = patientUsers.filter(u => !linkedSet.has(u._id.toString()));
    res.json({ users: unlinked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/patients/stats/summary
router.get('/stats/summary', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'patient') {
      filter = await _getPatientFilter(req.user);
    } else if (req.user.role === 'doctor') {
      filter.assignedDoctor = req.user._id;
    }

    const total     = await Patient.countDocuments(filter);
    const active    = await Patient.countDocuments({ ...filter, status: 'active' });
    const critical  = await Patient.countDocuments({ ...filter, status: 'critical' });
    const discharged = await Patient.countDocuments({ ...filter, status: 'discharged' });

    res.json({ stats: { total, active, critical, discharged } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: build a filter to find the Patient record belonging to a patient-role user
async function _getPatientFilter(user) {
  const linked = await Patient.findOne({ user: user._id });
  if (linked) return { user: user._id };
  const byName = await Patient.findOne({ name: { $regex: new RegExp(`^${user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  if (byName) {
    byName.user = user._id;
    await byName.save();
    return { user: user._id };
  }
  return { _id: null };
}

// GET /api/patients
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'patient') {
      query = await _getPatientFilter(req.user);
    } else if (req.user.role === 'doctor') {
      query.assignedDoctor = req.user._id;
    }
    const patients = await Patient.find(query)
      .populate('assignedDoctor', 'name email specialization')
      .sort({ createdAt: -1 });
    res.json({ patients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/patients/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      $or: [{ _id: req.params.id }, { patientId: req.params.id }]
    }).populate('assignedDoctor', 'name email specialization');
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (req.user.role === 'patient') {
      if (!patient.user || patient.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied. You can only view your own record.' });
      }
    }
    if (req.user.role === 'doctor') {
      if (!patient.assignedDoctor || patient.assignedDoctor._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied. This patient is not assigned to you.' });
      }
    }

    res.json({ patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/patients
router.post('/', auth, authorize('doctor', 'admin'), patientCreateValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const { name, age, gender, bloodGroup, phone, address, emergencyContact, medicalHistory, assignedDoctor, deviceId, linkedUserId } = req.body;
    const patient = new Patient({
      name, age, gender, bloodGroup, phone, address,
      emergencyContact, medicalHistory,
      assignedDoctor: assignedDoctor || req.user._id,
      deviceId: deviceId || `DEV-${Date.now()}`,
      user: linkedUserId || undefined
    });
    await patient.save();
    await patient.populate('assignedDoctor', 'name email specialization');

    // M-5: Audit patient creation
    await AuditLog.create({
      action: `Patient created: ${patient.name} (${patient.patientId})`,
      category: 'patient',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'info'
    });

    res.status(201).json({ message: 'Patient registered successfully', patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/patients/:id — H-5: whitelist fields only & doctor assignment check
router.put('/:id', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const existing = await Patient.findOne({
      $or: [{ _id: req.params.id }, { patientId: req.params.id }]
    });
    if (!existing) return res.status(404).json({ error: 'Patient not found' });

    // Enforce doctor assignment authorization
    if (req.user.role === 'doctor') {
      if (!existing.assignedDoctor || existing.assignedDoctor.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied. You can only update patients assigned to you.' });
      }
    }

    // H-5: Build update object from whitelisted fields only
    const update = {};
    for (const field of PATIENT_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    }

    const patient = await Patient.findOneAndUpdate(
      { $or: [{ _id: req.params.id }, { patientId: req.params.id }] },
      { $set: update },
      { new: true, runValidators: true }
    ).populate('assignedDoctor', 'name email specialization');

    // M-5: Audit patient update (log field names only, no PHI values)
    await AuditLog.create({
      action: `Patient updated: ${patient.name} (${patient.patientId}) — fields: ${Object.keys(update).join(', ')}`,
      category: 'patient',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'info'
    });

    res.json({ message: 'Patient updated', patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/patients/:id — Admin: deletes patient and cascades cleanup (right-to-erasure)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const patient = await Patient.findOneAndDelete({
      $or: [{ _id: req.params.id }, { patientId: req.params.id }]
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const pId = patient.patientId;

    // Cascade deletion of sensitive clinical records (right-to-erasure / minimization)
    await HealthData.deleteMany({ patientId: pId });
    await Alert.deleteMany({ patientId: pId });

    // Clean up associated medical report files on disk and records in DB
    const uploadDir = path.join(__dirname, '../uploads');
    const reports = await Report.find({ patientId: pId });
    for (const rep of reports) {
      if (rep.filePath) {
        const fPath = path.join(uploadDir, path.basename(rep.filePath));
        if (fs.existsSync(fPath)) {
          try { fs.unlinkSync(fPath); } catch (_) {}
        }
      }
    }
    await Report.deleteMany({ patientId: pId });

    // M-5: Audit patient deletion
    await AuditLog.create({
      action: `Patient deleted and purged: ${patient.name} (${patient.patientId})`,
      category: 'patient',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'warning'
    });

    res.json({ message: 'Patient and associated clinical records purged successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
