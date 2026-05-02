const express = require('express');
const HealthData = require('../models/HealthData');
const Patient = require('../models/Patient');
const { auth } = require('../middleware/auth');
const { checkThresholds } = require('../utils/alertChecker');

const router = express.Router();

// GET /api/health-data/stats/overview - Overall system stats (BEFORE /:patientId)
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalReadings = await HealthData.countDocuments();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReadings = await HealthData.countDocuments({ timestamp: { $gte: last24h } });
    const criticalCount = await HealthData.countDocuments({ status: 'critical', timestamp: { $gte: last24h } });
    const warningCount = await HealthData.countDocuments({ status: 'warning', timestamp: { $gte: last24h } });

    const latestReadings = await HealthData.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$patientId', heartRate: { $first: '$heartRate' }, spO2: { $first: '$spO2' }, temperature: { $first: '$temperature' }, status: { $first: '$status' }, timestamp: { $first: '$timestamp' } } }
    ]);

    res.json({ stats: { totalReadings, recentReadings, criticalCount, warningCount, activeDevices: latestReadings.length }, latestReadings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health-data - Store new health reading (from IoT simulator)
router.post('/', async (req, res) => {
  try {
    const { patientId, deviceId, heartRate, spO2, temperature } = req.body;
    if (!patientId || heartRate == null || spO2 == null || temperature == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const patient = await Patient.findOne({ patientId });
    const patientName = patient ? patient.name : 'Unknown';
    const io = req.app.get('io');

    const { status } = await checkThresholds({ patientId, patientName, heartRate, spO2, temperature }, io);

    const healthData = new HealthData({ patientId, deviceId: deviceId || 'SIM-ESP32-001', heartRate, spO2, temperature, status });
    await healthData.save();

    if (patient && status === 'critical') {
      patient.status = 'critical';
      await patient.save();
    }

    if (io) {
      io.emit('health-data', { patientId, patientName, heartRate, spO2, temperature, status, timestamp: healthData.timestamp });
    }

    res.status(201).json({ message: 'Health data stored', data: healthData, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health-data/:patientId/latest - Get latest reading
router.get('/:patientId/latest', auth, async (req, res) => {
  try {
    const data = await HealthData.findOne({ patientId: req.params.patientId }).sort({ timestamp: -1 });
    if (!data) return res.status(404).json({ error: 'No health data found' });
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health-data/:patientId - Get health data for a patient
router.get('/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 100, from, to } = req.query;
    let query = { patientId };
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }
    const data = await HealthData.find(query).sort({ timestamp: -1 }).limit(parseInt(limit));
    res.json({ data: data.reverse() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
