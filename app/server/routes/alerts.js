const express = require('express');
const Alert = require('../models/Alert');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts/stats/summary - Alert statistics (BEFORE /:id)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const total = await Alert.countDocuments();
    const unacknowledged = await Alert.countDocuments({ acknowledged: false });
    const critical = await Alert.countDocuments({ type: 'critical', acknowledged: false });
    const warning = await Alert.countDocuments({ type: 'warning', acknowledged: false });
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await Alert.countDocuments({ createdAt: { $gte: last24h } });
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

// GET /api/alerts - Get all alerts
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50, acknowledged, type, patientId } = req.query;
    let query = {};
    if (acknowledged !== undefined) query.acknowledged = acknowledged === 'true';
    if (type) query.type = type;
    if (patientId) query.patientId = patientId;

    const alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).populate('acknowledgedBy', 'name role');
    const unacknowledgedCount = await Alert.countDocuments({ acknowledged: false });
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
