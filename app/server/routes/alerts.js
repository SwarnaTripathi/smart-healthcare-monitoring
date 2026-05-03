const express = require('express');
const Alert = require('../models/Alert');
const Patient = require('../models/Patient');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper: get the patientId string for a patient-role user
async function _getPatientIdForUser(user) {
  const patient = await Patient.findOne({ user: user._id });
  if (patient) return patient.patientId;
  // Fallback: match by name
  const byName = await Patient.findOne({ name: { $regex: new RegExp(`^${user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  if (byName) {
    byName.user = user._id;
    await byName.save();
    return byName.patientId;
  }
  return null;
}

// GET /api/alerts/stats/summary - Alert statistics (BEFORE /:id)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'patient') {
      const pid = await _getPatientIdForUser(req.user);
      if (pid) filter.patientId = pid;
      else return res.json({ stats: { total: 0, unacknowledged: 0, critical: 0, warning: 0, recent: 0 } });
    }

    const total = await Alert.countDocuments(filter);
    const unacknowledged = await Alert.countDocuments({ ...filter, acknowledged: false });
    const critical = await Alert.countDocuments({ ...filter, type: 'critical', acknowledged: false });
    const warning = await Alert.countDocuments({ ...filter, type: 'warning', acknowledged: false });
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await Alert.countDocuments({ ...filter, createdAt: { $gte: last24h } });
    res.json({ stats: { total, unacknowledged, critical, warning, recent } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/alerts/acknowledge-all (BEFORE /:id)
router.put('/acknowledge-all', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    await Alert.updateMany({ acknowledged: false }, { acknowledged: true, acknowledgedBy: req.user._id, acknowledgedAt: new Date() });
    res.json({ message: 'All alerts acknowledged' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts - Get all alerts (role-filtered)
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50, acknowledged, type, patientId } = req.query;
    let query = {};
    if (acknowledged !== undefined) query.acknowledged = acknowledged === 'true';
    if (type) query.type = type;
    if (patientId) query.patientId = patientId;

    // Patient users can only see their own alerts
    if (req.user.role === 'patient') {
      const pid = await _getPatientIdForUser(req.user);
      if (pid) query.patientId = pid;
      else return res.json({ alerts: [], unacknowledgedCount: 0 });
    }

    const alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).populate('acknowledgedBy', 'name role');
    const unackFilter = req.user.role === 'patient' && query.patientId ? { acknowledged: false, patientId: query.patientId } : { acknowledged: false };
    const unacknowledgedCount = await Alert.countDocuments(unackFilter);
    res.json({ alerts, unacknowledgedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/alerts/:id/acknowledge
router.put('/:id/acknowledge', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { acknowledged: true, acknowledgedBy: req.user._id, acknowledgedAt: new Date() }, { new: true }).populate('acknowledgedBy', 'name role');
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    const io = req.app.get('io');
    if (io) io.emit('alert-acknowledged', alert);
    res.json({ message: 'Alert acknowledged', alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ message: 'Alert deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
