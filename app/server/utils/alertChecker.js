const Alert = require('../models/Alert');
const HealthData = require('../models/HealthData');

// ── Educational & Demonstration Disclaimer (Requirement 10) ───────────────────
// These thresholds are for educational / prototype demonstration purposes only
// and are NOT clinically validated for medical diagnosis or clinical triage.
const DEMONSTRATION_DISCLAIMER =
  'Notice: Demonstration prototype only. Thresholds and trend detectors are not clinically validated for diagnostic decision-making.';

// ── Configurable Demonstration Thresholds (Requirement 10) ────────────────────
const THRESHOLDS = {
  heartRate: {
    critical: {
      min: parseInt(process.env.DEMO_HR_CRITICAL_MIN, 10) || 40,
      max: parseInt(process.env.DEMO_HR_CRITICAL_MAX, 10) || 150
    },
    warning: {
      min: parseInt(process.env.DEMO_HR_WARNING_MIN, 10) || 50,
      max: parseInt(process.env.DEMO_HR_WARNING_MAX, 10) || 120
    }
  },
  spO2: {
    critical: {
      min: 0,
      max: parseInt(process.env.DEMO_SPO2_CRITICAL_MAX, 10) || 90
    },
    warning: {
      min: 0,
      max: parseInt(process.env.DEMO_SPO2_WARNING_MAX, 10) || 94
    }
  },
  temperature: {
    critical: {
      min: parseFloat(process.env.DEMO_TEMP_CRITICAL_MIN) || 35.0,
      max: parseFloat(process.env.DEMO_TEMP_CRITICAL_MAX) || 39.5
    },
    warning: {
      min: parseFloat(process.env.DEMO_TEMP_WARNING_MIN) || 36.0,
      max: parseFloat(process.env.DEMO_TEMP_WARNING_MAX) || 38.0
    }
  }
};

// ── Deduplication window (Requirement 6) ──────────────────────────────────────
const DEDUP_WINDOW_MINUTES = parseInt(process.env.DEDUP_WINDOW_MINUTES, 10) || 10;

async function _isDuplicate(patientId, metric, type, ruleId = null) {
  const since = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000);
  const query = {
    patientId,
    metric,
    status: { $in: ['open', 'acknowledged'] },
    createdAt: { $gte: since }
  };
  if (ruleId) query.ruleId = ruleId;
  const existing = await Alert.findOne(query);
  return !!existing;
}

// ── Patient-Specific Baseline Computation (Requirements 4 & 9) ─────────────────
const MIN_BASELINE_READINGS = 20;

/**
 * Computes patient-specific mean and standard deviation for a given metric.
 * Explicitly indicates uncertainty when fewer than 20 readings exist.
 */
async function computePatientBaseline(patientId, metric) {
  const readings = await HealthData.find({ patientId })
    .sort({ timestamp: -1 })
    .limit(50)
    .select(metric)
    .lean();

  const values = readings
    .map(r => r[metric])
    .filter(v => typeof v === 'number' && !isNaN(v));

  if (values.length < MIN_BASELINE_READINGS) {
    return {
      available: false,
      sampleSize: values.length,
      minRequired: MIN_BASELINE_READINGS,
      reason: `Insufficient historical data (${values.length}/${MIN_BASELINE_READINGS} readings). Using population demonstration thresholds.`
    };
  }

  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);

  return {
    available: true,
    sampleSize: values.length,
    minRequired: MIN_BASELINE_READINGS,
    mean: Math.round(mean * 10) / 10,
    stdDev: Math.round(stdDev * 100) / 100,
    reason: `Baseline calculated across ${values.length} historical readings.`
  };
}

// ── Statistical Trend Helpers (Requirements 3 & 9) ────────────────────────────
const TREND_WINDOW = 10;
const TREND_SLOPE_HR   = -1.5; // bpm/reading
const TREND_SLOPE_SPO2 = -0.3; // %/reading

/**
 * Linear regression slope calculation.
 */
function _slope(values) {
  const n = values.length;
  if (n < 3) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  values.forEach((y, x) => {
    sumX  += x;
    sumY  += y;
    sumXY += x * y;
    sumX2 += x * x;
  });
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

/**
 * Linear regression R-squared (goodness of fit) for uncertainty estimation.
 */
function _rSquared(values, slope) {
  const n = values.length;
  if (n < 3) return 0;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0, ssRes = 0;
  values.forEach((y, x) => {
    ssTot += Math.pow(y - meanY, 2);
    const predicted = meanY + slope * (x - (n - 1) / 2);
    ssRes += Math.pow(y - predicted, 2);
  });
  return ssTot === 0 ? 1 : Math.max(0, 1 - (ssRes / ssTot));
}

/**
 * Detect gradual deterioration trends over the last N readings.
 */
async function _detectTrends(patientId, patientName, recentReadings) {
  if (!recentReadings || recentReadings.length < 5) {
    return []; // Insufficient data to assert trend with statistical confidence
  }

  const hrValues   = recentReadings.map(r => r.heartRate).reverse();
  const spo2Values = recentReadings.map(r => r.spO2).reverse();
  const trendAlerts = [];

  // SpO2 declining trend
  const spo2Slope = _slope(spo2Values);
  const spo2R2 = _rSquared(spo2Values, spo2Slope);
  const latestSpO2 = spo2Values[spo2Values.length - 1];

  if (spo2Slope <= TREND_SLOPE_SPO2 && latestSpO2 < 97) {
    const ruleId = 'RULE_SPO2_STATISTICAL_DECLINE';
    const isDup = await _isDuplicate(patientId, 'spO2', 'warning', ruleId);
    if (!isDup) {
      const confidence = spo2R2 >= 0.7 ? 'high' : spo2R2 >= 0.4 ? 'moderate' : 'low';
      const supporting = recentReadings.slice(0, 5).map(r => ({
        timestamp: r.timestamp,
        value: r.spO2,
        metric: 'spO2'
      }));

      trendAlerts.push({
        patientId,
        patientName: patientName || 'Unknown',
        type: 'warning',
        metric: 'spO2',
        status: 'open',
        ruleId,
        source: 'statistical_trend',
        confidence,
        message: `TREND ⬇️: SpO2 declining (slope ${spo2Slope.toFixed(2)}%/reading, R²=${spo2R2.toFixed(2)}, current: ${latestSpO2}%). Confidence: ${confidence}.`,
        explanation: `Linear regression over ${recentReadings.length} readings identified progressive oxygen desaturation. Goodness-of-fit R² is ${spo2R2.toFixed(2)}.`,
        supportingReadings: supporting,
        value: latestSpO2,
        threshold: `Slope ≤ ${TREND_SLOPE_SPO2}%/reading`,
        demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
      });
    }
  }

  // Heart rate declining trend
  const hrSlope = _slope(hrValues);
  const hrR2 = _rSquared(hrValues, hrSlope);
  const latestHR = hrValues[hrValues.length - 1];

  if (hrSlope <= TREND_SLOPE_HR && latestHR < 65) {
    const ruleId = 'RULE_HR_STATISTICAL_DECLINE';
    const isDup = await _isDuplicate(patientId, 'heartRate', 'warning', ruleId);
    if (!isDup) {
      const confidence = hrR2 >= 0.7 ? 'high' : hrR2 >= 0.4 ? 'moderate' : 'low';
      const supporting = recentReadings.slice(0, 5).map(r => ({
        timestamp: r.timestamp,
        value: r.heartRate,
        metric: 'heartRate'
      }));

      trendAlerts.push({
        patientId,
        patientName: patientName || 'Unknown',
        type: 'warning',
        metric: 'heartRate',
        status: 'open',
        ruleId,
        source: 'statistical_trend',
        confidence,
        message: `TREND ⬇️: Heart rate declining (slope ${hrSlope.toFixed(1)} bpm/reading, R²=${hrR2.toFixed(2)}, current: ${latestHR} bpm). Confidence: ${confidence}.`,
        explanation: `Linear regression over ${recentReadings.length} readings identified downward rate trend. Goodness-of-fit R² is ${hrR2.toFixed(2)}.`,
        supportingReadings: supporting,
        value: latestHR,
        threshold: `Slope ≤ ${TREND_SLOPE_HR} bpm/reading`,
        demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
      });
    }
  }

  return trendAlerts;
}

// ── Sustained Abnormal Check Helper (Requirement 3) ───────────────────────────
function _checkSustained(recentReadings, metric, testFn, minConsecutive = 2) {
  if (!recentReadings || recentReadings.length === 0) return { sustained: false, count: 0 };
  let consecutive = 0;
  for (const r of recentReadings) {
    if (r && testFn(r[metric])) {
      consecutive++;
    } else {
      break;
    }
  }
  return {
    sustained: consecutive >= minConsecutive,
    count: consecutive
  };
}

// ── Auto-Resolution of Normalized Alerts (Requirement 7) ──────────────────────
async function _autoResolveNormalizedAlerts(patientId, metric, recentReadings, isNormalFn, io) {
  if (!recentReadings || recentReadings.length < 3) return;

  const isNormalized = recentReadings.slice(0, 3).every(r => isNormalFn(r[metric]));
  if (!isNormalized) return;

  const openAlerts = await Alert.find({ patientId, metric, status: 'open' });
  if (openAlerts.length === 0) return;

  const now = new Date();
  await Alert.updateMany(
    { patientId, metric, status: 'open' },
    {
      status: 'resolved',
      resolved: true,
      resolvedAt: now,
      resolutionReason: `Auto-resolved: ${metric} returned to normal range for 3 consecutive readings.`
    }
  );

  if (io) {
    openAlerts.forEach(alert => {
      const resolvedPayload = {
        _id: alert._id,
        patientId,
        metric,
        status: 'resolved',
        resolved: true,
        resolvedAt: now,
        resolutionReason: `Auto-resolved: ${metric} normalized.`
      };
      io.to(`patient:${patientId}`).emit('alert-resolved', resolvedPayload);
      io.to('admin').emit('alert-resolved', resolvedPayload);
    });
  }
}

// ── Main Threshold, Sustained-Change & Trend Evaluation ────────────────────────
/**
 * Evaluates current reading against thresholds, baselines, and statistical trends.
 * 
 * @param {Object} data - { patientId, patientName, heartRate, spO2, temperature }
 * @param {Object|null} io - Socket.IO instance for real-time dispatch
 * @returns {Promise<{ status: string, alerts: Array, baselineContext: Object }>}
 */
async function checkThresholds(data, io = null) {
  const { patientId, patientName, heartRate, spO2, temperature } = data;
  const candidates = [];
  let overallStatus = 'normal';

  // Fetch recent readings for trend, sustained change, and baseline context
  const recentReadings = await HealthData.find({ patientId })
    .sort({ timestamp: -1 })
    .limit(TREND_WINDOW)
    .lean();

  // Baseline evaluation (HR as primary baseline example)
  const hrBaseline = await computePatientBaseline(patientId, 'heartRate');

  // Format supporting reading snapshots
  const formatSupporting = (metric) => {
    return recentReadings.slice(0, 5).map(r => ({
      timestamp: r.timestamp,
      value: r[metric],
      metric
    }));
  };

  // 1. HEART RATE EVALUATION
  const hrCriticalTest = v => v < THRESHOLDS.heartRate.critical.min || v > THRESHOLDS.heartRate.critical.max;
  const hrWarningTest  = v => v < THRESHOLDS.heartRate.warning.min  || v > THRESHOLDS.heartRate.warning.max;

  if (hrCriticalTest(heartRate)) {
    overallStatus = 'critical';
    const ruleId = heartRate > THRESHOLDS.heartRate.critical.max ? 'RULE_HR_CRITICAL_HIGH' : 'RULE_HR_CRITICAL_LOW';
    const isDup = await _isDuplicate(patientId, 'heartRate', 'critical', ruleId);
    if (!isDup) {
      const { count } = _checkSustained(recentReadings, 'heartRate', hrCriticalTest, 1);
      candidates.push({
        patientId,
        patientName: patientName || 'Unknown',
        type: 'critical',
        metric: 'heartRate',
        status: 'open',
        ruleId,
        source: 'rule_based',
        confidence: 'high',
        message: `🔴 CRITICAL: Heart rate is ${heartRate} bpm (Normal: 60–100 bpm). Abnormal for ${count + 1} recent readings.`,
        explanation: `Rule ${ruleId} fired because reading ${heartRate} bpm breached critical threshold (${THRESHOLDS.heartRate.critical.min}–${THRESHOLDS.heartRate.critical.max} bpm).`,
        supportingReadings: formatSupporting('heartRate'),
        baselineContext: hrBaseline,
        value: heartRate,
        threshold: `${THRESHOLDS.heartRate.critical.min}–${THRESHOLDS.heartRate.critical.max} bpm`,
        demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
      });
    }
  } else if (hrWarningTest(heartRate)) {
    // Sustained change check for warning tier (avoid single-reading false alarm spikes)
    const { sustained, count } = _checkSustained(recentReadings, 'heartRate', hrWarningTest, 2);
    if (sustained || recentReadings.length < 2) {
      if (overallStatus !== 'critical') overallStatus = 'warning';
      const ruleId = heartRate > THRESHOLDS.heartRate.warning.max ? 'RULE_HR_SUSTAINED_WARNING_HIGH' : 'RULE_HR_SUSTAINED_WARNING_LOW';
      const isDup = await _isDuplicate(patientId, 'heartRate', 'warning', ruleId);
      if (!isDup) {
        candidates.push({
          patientId,
          patientName: patientName || 'Unknown',
          type: 'warning',
          metric: 'heartRate',
          status: 'open',
          ruleId,
          source: 'rule_based',
          confidence: 'high',
          message: `🟡 WARNING: Heart rate is ${heartRate} bpm. Sustained abnormal for ${count + 1} consecutive readings.`,
          explanation: `Rule ${ruleId} fired because heart rate remained outside warning bounds (${THRESHOLDS.heartRate.warning.min}–${THRESHOLDS.heartRate.warning.max} bpm) across consecutive cycles.`,
          supportingReadings: formatSupporting('heartRate'),
          baselineContext: hrBaseline,
          value: heartRate,
          threshold: `${THRESHOLDS.heartRate.warning.min}–${THRESHOLDS.heartRate.warning.max} bpm`,
          demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
        });
      }
    }
  } else {
    // Normal HR — check auto-resolve of previously open HR alerts
    await _autoResolveNormalizedAlerts(
      patientId,
      'heartRate',
      [{ heartRate }, ...recentReadings],
      v => v >= THRESHOLDS.heartRate.warning.min && v <= THRESHOLDS.heartRate.warning.max,
      io
    );
  }

  // Baseline deviation check: If patient-specific baseline is available, check for significant shift (> 2.5 std devs)
  if (hrBaseline.available && overallStatus === 'normal') {
    const zScore = (heartRate - hrBaseline.mean) / (hrBaseline.stdDev || 1);
    if (Math.abs(zScore) >= 2.5) {
      const ruleId = 'RULE_HR_BASELINE_DEVIATION';
      const isDup = await _isDuplicate(patientId, 'heartRate', 'warning', ruleId);
      if (!isDup) {
        if (overallStatus !== 'critical') overallStatus = 'warning';
        candidates.push({
          patientId,
          patientName: patientName || 'Unknown',
          type: 'warning',
          metric: 'heartRate',
          status: 'open',
          ruleId,
          source: 'baseline_deviation',
          confidence: 'moderate',
          message: `ℹ️ BASELINE SHIFT: Heart rate ${heartRate} bpm deviates by ${zScore.toFixed(1)}σ from personal baseline (${hrBaseline.mean} ± ${hrBaseline.stdDev} bpm).`,
          explanation: `Patient personal baseline is ${hrBaseline.mean} bpm (N=${hrBaseline.sampleSize}). Reading represents a statistically significant individualized departure.`,
          supportingReadings: formatSupporting('heartRate'),
          baselineContext: hrBaseline,
          value: heartRate,
          threshold: `Baseline mean ${hrBaseline.mean} ± ${hrBaseline.stdDev * 2.5} bpm`,
          demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
        });
      }
    }
  }

  // 2. SPO2 EVALUATION
  const spo2CriticalTest = v => v < THRESHOLDS.spO2.critical.max;
  const spo2WarningTest  = v => v < THRESHOLDS.spO2.warning.max;

  if (spo2CriticalTest(spO2)) {
    overallStatus = 'critical';
    const ruleId = 'RULE_SPO2_CRITICAL_LOW';
    const isDup = await _isDuplicate(patientId, 'spO2', 'critical', ruleId);
    if (!isDup) {
      const { count } = _checkSustained(recentReadings, 'spO2', spo2CriticalTest, 1);
      candidates.push({
        patientId,
        patientName: patientName || 'Unknown',
        type: 'critical',
        metric: 'spO2',
        status: 'open',
        ruleId,
        source: 'rule_based',
        confidence: 'high',
        message: `🔴 CRITICAL: SpO2 is ${spO2}% (Critical cutoff < ${THRESHOLDS.spO2.critical.max}%). Immediate oxygen therapy assessment advised.`,
        explanation: `Rule ${ruleId} fired because saturation fell below critical threshold of ${THRESHOLDS.spO2.critical.max}%. Abnormal for ${count + 1} recent cycles.`,
        supportingReadings: formatSupporting('spO2'),
        value: spO2,
        threshold: `< ${THRESHOLDS.spO2.critical.max}%`,
        demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
      });
    }
  } else if (spo2WarningTest(spO2)) {
    const { sustained, count } = _checkSustained(recentReadings, 'spO2', spo2WarningTest, 2);
    if (sustained || recentReadings.length < 2) {
      if (overallStatus !== 'critical') overallStatus = 'warning';
      const ruleId = 'RULE_SPO2_SUSTAINED_WARNING';
      const isDup = await _isDuplicate(patientId, 'spO2', 'warning', ruleId);
      if (!isDup) {
        candidates.push({
          patientId,
          patientName: patientName || 'Unknown',
          type: 'warning',
          metric: 'spO2',
          status: 'open',
          ruleId,
          source: 'rule_based',
          confidence: 'high',
          message: `🟡 WARNING: SpO2 is ${spO2}% (Warning cutoff < ${THRESHOLDS.spO2.warning.max}%). Sustained for ${count + 1} readings.`,
          explanation: `Rule ${ruleId} triggered due to sustained oxygen saturation below ${THRESHOLDS.spO2.warning.max}% across consecutive telemetry cycles.`,
          supportingReadings: formatSupporting('spO2'),
          value: spO2,
          threshold: `< ${THRESHOLDS.spO2.warning.max}%`,
          demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
        });
      }
    }
  } else {
    // Normal SpO2 — auto-resolve open SpO2 alerts
    await _autoResolveNormalizedAlerts(
      patientId,
      'spO2',
      [{ spO2 }, ...recentReadings],
      v => v >= THRESHOLDS.spO2.warning.max,
      io
    );
  }

  // 3. TEMPERATURE EVALUATION
  const tempCriticalTest = v => v < THRESHOLDS.temperature.critical.min || v > THRESHOLDS.temperature.critical.max;
  const tempWarningTest  = v => v < THRESHOLDS.temperature.warning.min  || v > THRESHOLDS.temperature.warning.max;

  if (tempCriticalTest(temperature)) {
    overallStatus = 'critical';
    const ruleId = temperature > THRESHOLDS.temperature.critical.max ? 'RULE_TEMP_HYPERPYREXIA' : 'RULE_TEMP_SEVERE_HYPOTHERMIA';
    const isDup = await _isDuplicate(patientId, 'temperature', 'critical', ruleId);
    if (!isDup) {
      candidates.push({
        patientId,
        patientName: patientName || 'Unknown',
        type: 'critical',
        metric: 'temperature',
        status: 'open',
        ruleId,
        source: 'rule_based',
        confidence: 'high',
        message: `🔴 CRITICAL: Temperature is ${temperature}°C. Physiological danger threshold breached (${THRESHOLDS.temperature.critical.min}–${THRESHOLDS.temperature.critical.max}°C).`,
        explanation: `Rule ${ruleId} fired due to critical thermal departure. Immediate environmental or pharmacological intervention indicated.`,
        supportingReadings: formatSupporting('temperature'),
        value: temperature,
        threshold: `${THRESHOLDS.temperature.critical.min}–${THRESHOLDS.temperature.critical.max}°C`,
        demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
      });
    }
  } else if (tempWarningTest(temperature)) {
    const { sustained, count } = _checkSustained(recentReadings, 'temperature', tempWarningTest, 2);
    if (sustained || recentReadings.length < 2) {
      if (overallStatus !== 'critical') overallStatus = 'warning';
      const ruleId = temperature > THRESHOLDS.temperature.warning.max ? 'RULE_TEMP_FEVER_WARNING' : 'RULE_TEMP_MILD_HYPOTHERMIA';
      const isDup = await _isDuplicate(patientId, 'temperature', 'warning', ruleId);
      if (!isDup) {
        candidates.push({
          patientId,
          patientName: patientName || 'Unknown',
          type: 'warning',
          metric: 'temperature',
          status: 'open',
          ruleId,
          source: 'rule_based',
          confidence: 'high',
          message: `🟡 WARNING: Temperature is ${temperature}°C. Sustained for ${count + 1} readings.`,
          explanation: `Rule ${ruleId} fired due to sustained departure outside normal demonstration temperature bounds (${THRESHOLDS.temperature.warning.min}–${THRESHOLDS.temperature.warning.max}°C).`,
          supportingReadings: formatSupporting('temperature'),
          value: temperature,
          threshold: `${THRESHOLDS.temperature.warning.min}–${THRESHOLDS.temperature.warning.max}°C`,
          demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
        });
      }
    }
  } else {
    // Normal temperature — auto-resolve open temperature alerts
    await _autoResolveNormalizedAlerts(
      patientId,
      'temperature',
      [{ temperature }, ...recentReadings],
      v => v >= THRESHOLDS.temperature.warning.min && v <= THRESHOLDS.temperature.warning.max,
      io
    );
  }

  // 4. STATISTICAL TREND DETECTION (Requirements 3, 5, 8, 9)
  const trendAlerts = await _detectTrends(patientId, patientName, recentReadings);
  candidates.push(...trendAlerts);

  // 5. PERSIST AND BROADCAST
  if (candidates.length > 0) {
    const savedAlerts = await Alert.insertMany(candidates);
    if (io) {
      savedAlerts.forEach(alert => {
        io.to(`patient:${patientId}`).emit('new-alert', alert);
        io.to('admin').emit('new-alert', alert);
      });
    }
  }

  return {
    status: overallStatus,
    alerts: candidates,
    baselineContext: hrBaseline,
    demonstrationDisclaimer: DEMONSTRATION_DISCLAIMER
  };
}

module.exports = {
  checkThresholds,
  computePatientBaseline,
  _slope,
  _rSquared,
  _checkSustained,
  THRESHOLDS,
  DEMONSTRATION_DISCLAIMER
};
