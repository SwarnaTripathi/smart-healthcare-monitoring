const express = require('express');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/patients/unlinked-users - Newly registered patients not yet added to any doctor's list
// Both doctors and admins can see this list
router.get('/unlinked-users', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    // Find all patient-role users
    const patientUsers = await User.find({ role: 'patient', isActive: true }).select('-password').sort({ createdAt: -1 });

    // Find which user IDs already have a Patient record
    const linkedUserIds = await Patient.distinct('user', { user: { $ne: null } });
    const linkedSet = new Set(linkedUserIds.map(id => id.toString()));

    // Filter to only unlinked users
    const unlinked = patientUsers.filter(u => !linkedSet.has(u._id.toString()));

    res.json({ users: unlinked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/patients/stats/summary - Dashboard stats (MUST be before /:id)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'patient') {
      // Patients only see their own stats
      filter = await _getPatientFilter(req.user);
    } else if (req.user.role === 'doctor') {
      filter.assignedDoctor = req.user._id;
    }

    const total = await Patient.countDocuments(filter);
    const active = await Patient.countDocuments({ ...filter, status: 'active' });
    const critical = await Patient.countDocuments({ ...filter, status: 'critical' });
    const discharged = await Patient.countDocuments({ ...filter, status: 'discharged' });

    res.json({
      stats: { total, active, critical, discharged }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: build a filter to find the Patient record belonging to a patient-role user
async function _getPatientFilter(user) {
  // First try the explicit `user` link
  const linked = await Patient.findOne({ user: user._id });
  if (linked) return { user: user._id };
  // Fallback: match by name (case-insensitive)
  const byName = await Patient.findOne({ name: { $regex: new RegExp(`^${user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  if (byName) {
    // Auto-link for future queries
    byName.user = user._id;
    await byName.save();
    return { user: user._id };
  }
  // No record found — return impossible filter so an empty array comes back
  return { _id: null };
}

// GET /api/patients - Get all patients (role-filtered)
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'patient') {
      // Patients can only see their own record
      query = await _getPatientFilter(req.user);
    } else if (req.user.role === 'doctor') {
      query.assignedDoctor = req.user._id;
    }
    // Admins: no filter — see all patients
    const patients = await Patient.find(query)
      .populate('assignedDoctor', 'name email specialization')
      .sort({ createdAt: -1 });
    res.json({ patients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/patients/:id - Get single patient (role-restricted)
router.get('/:id', auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      $or: [{ _id: req.params.id }, { patientId: req.params.id }]
    }).populate('assignedDoctor', 'name email specialization');
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Patients can only view their own record
    if (req.user.role === 'patient') {
      if (!patient.user || patient.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied. You can only view your own record.' });
      }
    }
    // Doctors can only view their assigned patients
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

// POST /api/patients - Create patient
router.post('/', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const { name, age, gender, bloodGroup, phone, address, emergencyContact, medicalHistory, assignedDoctor, deviceId, linkedUserId } = req.body;
    const patient = new Patient({
      name, age, gender, bloodGroup, phone, address, emergencyContact, medicalHistory,
      assignedDoctor: assignedDoctor || req.user._id,
      deviceId: deviceId || `DEV-${Date.now()}`,
      user: linkedUserId || undefined
    });
    await patient.save();
    await patient.populate('assignedDoctor', 'name email specialization');
    res.status(201).json({ message: 'Patient registered successfully', patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/patients/:id - Update patient
router.put('/:id', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const patient = await Patient.findOneAndUpdate(
      { $or: [{ _id: req.params.id }, { patientId: req.params.id }] },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('assignedDoctor', 'name email specialization');
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json({ message: 'Patient updated', patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/patients/:id - Delete patient (admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const patient = await Patient.findOneAndDelete({
      $or: [{ _id: req.params.id }, { patientId: req.params.id }]
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
