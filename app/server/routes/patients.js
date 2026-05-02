const express = require('express');
const Patient = require('../models/Patient');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/patients/stats/summary - Dashboard stats (MUST be before /:id)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const total = await Patient.countDocuments();
    const active = await Patient.countDocuments({ status: 'active' });
    const critical = await Patient.countDocuments({ status: 'critical' });
    const discharged = await Patient.countDocuments({ status: 'discharged' });

    res.json({
      stats: { total, active, critical, discharged }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/patients - Get all patients
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'doctor') {
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

// GET /api/patients/:id - Get single patient
router.get('/:id', auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      $or: [{ _id: req.params.id }, { patientId: req.params.id }]
    }).populate('assignedDoctor', 'name email specialization');
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json({ patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/patients - Create patient
router.post('/', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const { name, age, gender, bloodGroup, phone, address, emergencyContact, medicalHistory, assignedDoctor, deviceId } = req.body;
    const patient = new Patient({
      name, age, gender, bloodGroup, phone, address, emergencyContact, medicalHistory,
      assignedDoctor: assignedDoctor || req.user._id,
      deviceId: deviceId || `DEV-${Date.now()}`
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
