const express = require('express');
const HealthData = require('../models/HealthData');
const Patient = require('../models/Patient');
const { auth, authorize } = require('../middleware/auth');
const { checkThresholds } = require('../utils/alertChecker');
const { validateVitalReading } = require('../utils/vitalValidator');

const router = express.Router();

// ── Patient-level ownership helper (G1) ───────────────────────────────────────
// Returns true if `user` is authorised to read vitals for `patientId`.
async function _canReadPatient(user, patientId) {
  if (user.role === 'admin') return true;
  if (user.role === 'doctor') {
    const p = await Patient.findOne({ patientId, assignedDoctor: user._id });
    return !!p;
  }
  // patient role — must be the linked record
  const p = await Patient.findOne({ patientId, user: user._id });
  return !!p;
}

// ── Device API key check (C-2) ────────────────────────────────────────────────
function verifyDeviceKey(req, res, next) {
  const key = req.headers['x-device-key'];
  if (!key || key !== process.env.DEVICE_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing device API key.' });
  }
  next();
}

// GET /api/health-data/stats/overview — admin only (G4)
router.get('/stats/overview', auth, authorize('admin'), async (req, res) => {
  try {
    const totalReadings  = await HealthData.countDocuments();
    const last24h        = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReadings = await HealthData.countDocuments({ timestamp: { $gte: last24h } });
    const criticalCount  = await HealthData.countDocuments({ status: 'critical', timestamp: { $gte: last24h } });
    const warningCount   = await HealthData.countDocuments({ status: 'warning',  timestamp: { $gte: last24h } });

    const latestReadings = await HealthData.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: {
        _id: '$patientId',
        heartRate:   { $first: '$heartRate' },
        spO2:        { $first: '$spO2' },
        temperature: { $first: '$temperature' },
        status:      { $first: '$status' },
        timestamp:   { $first: '$timestamp' }
      }}
    ]);

    res.json({
      stats: { totalReadings, recentReadings, criticalCount, warningCount, activeDevices: latestReadings.length },
      latestReadings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health-data — IoT ingest (validated, quality-checked, device key required)
router.post('/', verifyDeviceKey, async (req, res) => {
  try {
    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: 'Missing required field: patientId' });
    }

    // Contextual lookup: retrieve previous reading for duplicate and noise analysis
    const lastReading = await HealthData.findOne({ patientId }).sort({ timestamp: -1 });

    // Validate reading: detects missing, unphysiologic, duplicate, stale, and noisy readings
    const validation = validateVitalReading(req.body, lastReading);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors[0],
        errors: validation.errors,
        code: 'VALIDATION_FAILED'
      });
    }

    // Ignore exact duplicate sensor bursts to prevent alert storms and DB bloat
    if (validation.isDuplicate) {
      return res.status(200).json({
        message: 'Duplicate reading detected and deduplicated; storage skipped.',
        isDuplicate: true
      });
    }

    const { sanitized } = validation;
    const patient     = await Patient.findOne({ patientId });
    const patientName = patient ? patient.name : 'Unknown';
    const io          = req.app.get('io');

    // Run threshold, sustained-change, baseline, and trend analysis
    const { status, alerts, baselineContext, demonstrationDisclaimer } = await checkThresholds({
      patientId: sanitized.patientId,
      patientName,
      heartRate: sanitized.heartRate,
      spO2: sanitized.spO2,
      temperature: sanitized.temperature
    }, io);

    const healthData = new HealthData({
      patientId: sanitized.patientId,
      deviceId: sanitized.deviceId,
      heartRate: sanitized.heartRate,
      spO2: sanitized.spO2,
      temperature: sanitized.temperature,
      // Extended ICU vitals (optional)
      ...(req.body.respRate !== undefined && { respRate: Number(req.body.respRate) }),
      ...(req.body.map      !== undefined && { map:      Number(req.body.map)      }),
      ...(req.body.sysBP    !== undefined && { sysBP:    Number(req.body.sysBP)    }),
      ...(req.body.etco2    !== undefined && { etco2:    Number(req.body.etco2)    }),
      status,
      dataQuality: sanitized.dataQuality,
      isSynthetic: req.body.isSynthetic !== undefined ? Boolean(req.body.isSynthetic) : true,
      syntheticProvenance: req.body.syntheticProvenance || 'SmartHealthcare-IoT-Simulator',
      // Persist simulator ground-truth label for ML training (prototype label — not clinical outcome)
      groundTruthLabel: req.body.groundTruthLabel || 'unknown',
      scenario: req.body.scenario || '',
      timestamp: sanitized.timestamp
    });
    await healthData.save();

    if (patient && status === 'critical') {
      patient.status = 'critical';
      await patient.save();
    }

    // L-5: Emit to specific rooms instead of broadcast-to-all
    if (io) {
      const payload = {
        patientId: sanitized.patientId,
        patientName,
        heartRate: sanitized.heartRate,
        spO2: sanitized.spO2,
        temperature: sanitized.temperature,
        // Extended ICU vitals (include only if present)
        ...(req.body.respRate !== undefined && { respRate: Number(req.body.respRate) }),
        ...(req.body.map      !== undefined && { map:      Number(req.body.map)      }),
        ...(req.body.sysBP    !== undefined && { sysBP:    Number(req.body.sysBP)    }),
        ...(req.body.etco2    !== undefined && { etco2:    Number(req.body.etco2)    }),
        status,
        dataQuality: sanitized.dataQuality,
        timestamp: healthData.timestamp
      };
      io.to(`patient:${patientId}`).emit('health-data', payload);
      io.to('admin').emit('health-data', payload);
    }

    res.status(201).json({
      message: 'Health data validated and stored',
      data: healthData,
      status,
      alertsCreated: alerts.length,
      baselineContext,
      dataQuality: sanitized.dataQuality,
      demonstrationDisclaimer
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health-data/:patientId/latest  (G1: ownership check)
router.get('/:patientId/latest', auth, async (req, res) => {
  try {
    if (!await _canReadPatient(req.user, req.params.patientId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const data = await HealthData.findOne({ patientId: req.params.patientId }).sort({ timestamp: -1 });
    if (!data) return res.status(404).json({ error: 'No health data found' });
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve health data.' });
  }
});

// GET /api/health-data/:patientId — L-6: limit capped at 500, G1: ownership check
router.get('/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;

    // G1: enforce patient-level ownership
    if (!await _canReadPatient(req.user, patientId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { limit = 100, from, to } = req.query;
    let query = { patientId };
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to)   query.timestamp.$lte = new Date(to);
    }

    // L-6: Cap unbounded queries
    const safeLimit = Math.min(parseInt(limit) || 100, 500);
    const data = await HealthData.find(query).sort({ timestamp: -1 }).limit(safeLimit);
    res.json({ data: data.reverse() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve health data.' });
  }
});

// ── Deterioration Prediction Routes ──────────────────────────────────────────
const { predictDeteriorationRisk } = require('../utils/deteriorationPredictor');

// GET /api/health-data/overview/deterioration-risks
// Returns 6-hour deterioration risks for all assigned/accessible patients
router.get('/overview/deterioration-risks', auth, async (req, res) => {
  try {
    let patientFilter = {};
    if (req.user.role === 'doctor') {
      patientFilter.assignedDoctor = req.user._id;
    } else if (req.user.role === 'patient') {
      patientFilter.user = req.user._id;
    }

    const patients = await Patient.find(patientFilter).select('patientId name status age gender assignedDoctor').lean();
    if (!patients.length) {
      return res.json({ risks: [] });
    }

    const results = await Promise.all(patients.map(async (p) => {
      try {
        const recentReadings = await HealthData.find({ patientId: p.patientId })
          .sort({ timestamp: -1 })
          .limit(60)
          .lean();

        if (!recentReadings || recentReadings.length < 5) {
          return {
            patientId: p.patientId,
            patientName: p.name,
            status: p.status,
            is_prediction_available: false,
            risk_level: 'UNAVAILABLE',
            risk_color: '#64748b',
            percentage: 'N/A',
            deterioration_probability_6h: null,
            reason: (!recentReadings || recentReadings.length === 0) ? 'NO_DATA' : 'INSUFFICIENT_HISTORY',
            key_drivers: ['Awaiting continuous telemetry data stream']
          };
        }

        const latestRecord = recentReadings[0];
        const ageMs = Date.now() - new Date(latestRecord.timestamp).getTime();
        const ageMinutes = Math.round(ageMs / (60 * 1000));

        const pred = await predictDeteriorationRisk(recentReadings.reverse());
        return {
          ...pred,
          patientId: p.patientId,
          patientName: p.name,
          status: p.status,
          age_minutes: ageMinutes,
          is_stale: ageMinutes > 30,
          last_timestamp: latestRecord.timestamp
        };
      } catch (err) {
        console.error(`Error predicting risk for ${p.patientId}:`, err);
        return {
          patientId: p.patientId,
          patientName: p.name,
          status: p.status,
          is_prediction_available: false,
          risk_level: 'UNAVAILABLE',
          risk_color: '#64748b',
          percentage: 'N/A',
          deterioration_probability_6h: null,
          reason: 'CALCULATION_ERROR'
        };
      }
    }));

    res.json({ risks: results });
  } catch (error) {
    console.error('Batch deterioration risk error:', error);
    res.status(500).json({ error: 'Failed to compute deterioration risks overview.' });
  }
});

// GET /api/health-data/:patientId/deterioration-risk
// Returns 6-hour patient deterioration risk score from trained LightGBM model
router.get('/:patientId/deterioration-risk', auth, async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!await _canReadPatient(req.user, patientId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Retrieve past 120 readings for patient (~1-2 hours of history)
    const recentReadings = await HealthData.find({ patientId })
      .sort({ timestamp: -1 })
      .limit(120)
      .lean();

    if (!recentReadings || recentReadings.length === 0) {
      return res.status(404).json({
        error: `No recent telemetry found for patient ${patientId}`,
        status: 'UNAVAILABLE',
        is_prediction_available: false,
        reason: 'PATIENT_OR_DATA_NOT_FOUND'
      });
    }

    if (recentReadings.length < 5) {
      return res.json({
        status: 'UNAVAILABLE',
        is_prediction_available: false,
        reason: 'INSUFFICIENT_HISTORY',
        sample_count: recentReadings.length,
        risk_level: 'UNAVAILABLE',
        clinical_recommendation: `Insufficient telemetry history (${recentReadings.length} readings; minimum 5 required for trend calculation). Predictive estimation unavailable.`,
        clinical_disclaimer: 'Machine learning decision-support estimate only. Not a medical diagnosis or treatment order.'
      });
    }

    const latestRecord = recentReadings[0];
    const ageMs = Date.now() - new Date(latestRecord.timestamp).getTime();
    const ageMinutes = Math.round(ageMs / (60 * 1000));

    const prediction = await predictDeteriorationRisk(recentReadings.reverse());
    prediction.age_minutes = ageMinutes;
    prediction.is_stale = ageMinutes > 30;
    if (prediction.is_stale) {
      prediction.stale_warning = `Telemetry was recorded ${ageMinutes}m ago. Displaying latest predictive analysis.`;
    }

    res.json(prediction);
  } catch (error) {
    console.error('Deterioration risk route error:', error);
    res.status(500).json({ error: 'Failed to compute deterioration risk.', status: 'UNAVAILABLE' });
  }
});

module.exports = router;
