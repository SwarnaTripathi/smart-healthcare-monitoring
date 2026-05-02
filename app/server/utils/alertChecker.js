const Alert = require('../models/Alert');

// Health thresholds
const THRESHOLDS = {
  heartRate: {
    critical: { min: 40, max: 150 },
    warning: { min: 50, max: 120 }
  },
  spO2: {
    critical: { min: 0, max: 90 },
    warning: { min: 0, max: 94 }
  },
  temperature: {
    critical: { min: 35.0, max: 39.5 },
    warning: { min: 36.0, max: 38.0 }
  }
};

/**
 * Check health data against thresholds and create alerts if needed
 * @param {Object} data - { patientId, patientName, heartRate, spO2, temperature }
 * @param {Object} io - Socket.IO instance for real-time alerts
 * @returns {Object} - { status, alerts }
 */
async function checkThresholds(data, io) {
  const { patientId, patientName, heartRate, spO2, temperature } = data;
  const alerts = [];
  let overallStatus = 'normal';

  // Check heart rate
  if (heartRate < THRESHOLDS.heartRate.critical.min || heartRate > THRESHOLDS.heartRate.critical.max) {
    overallStatus = 'critical';
    alerts.push({
      patientId,
      patientName: patientName || 'Unknown',
      type: 'critical',
      metric: 'heartRate',
      message: `CRITICAL: Heart rate is ${heartRate} bpm (Normal: 60-100 bpm)`,
      value: heartRate,
      threshold: '40-150 bpm'
    });
  } else if (heartRate < THRESHOLDS.heartRate.warning.min || heartRate > THRESHOLDS.heartRate.warning.max) {
    if (overallStatus !== 'critical') overallStatus = 'warning';
    alerts.push({
      patientId,
      patientName: patientName || 'Unknown',
      type: 'warning',
      metric: 'heartRate',
      message: `WARNING: Heart rate is ${heartRate} bpm (Normal: 60-100 bpm)`,
      value: heartRate,
      threshold: '50-120 bpm'
    });
  }

  // Check SpO2
  if (spO2 < THRESHOLDS.spO2.critical.max) {
    overallStatus = 'critical';
    alerts.push({
      patientId,
      patientName: patientName || 'Unknown',
      type: 'critical',
      metric: 'spO2',
      message: `CRITICAL: SpO2 is ${spO2}% (Normal: 95-100%)`,
      value: spO2,
      threshold: '> 90%'
    });
  } else if (spO2 < THRESHOLDS.spO2.warning.max) {
    if (overallStatus !== 'critical') overallStatus = 'warning';
    alerts.push({
      patientId,
      patientName: patientName || 'Unknown',
      type: 'warning',
      metric: 'spO2',
      message: `WARNING: SpO2 is ${spO2}% (Normal: 95-100%)`,
      value: spO2,
      threshold: '> 94%'
    });
  }

  // Check temperature
  if (temperature < THRESHOLDS.temperature.critical.min || temperature > THRESHOLDS.temperature.critical.max) {
    overallStatus = 'critical';
    alerts.push({
      patientId,
      patientName: patientName || 'Unknown',
      type: 'critical',
      metric: 'temperature',
      message: `CRITICAL: Temperature is ${temperature}°C (Normal: 36.1-37.2°C)`,
      value: temperature,
      threshold: '35.0-39.5°C'
    });
  } else if (temperature < THRESHOLDS.temperature.warning.min || temperature > THRESHOLDS.temperature.warning.max) {
    if (overallStatus !== 'critical') overallStatus = 'warning';
    alerts.push({
      patientId,
      patientName: patientName || 'Unknown',
      type: 'warning',
      metric: 'temperature',
      message: `WARNING: Temperature is ${temperature}°C (Normal: 36.1-37.2°C)`,
      value: temperature,
      threshold: '36.0-38.0°C'
    });
  }

  // Save alerts to database and emit via Socket.IO
  if (alerts.length > 0) {
    const savedAlerts = await Alert.insertMany(alerts);
    if (io) {
      savedAlerts.forEach(alert => {
        io.emit('new-alert', alert);
      });
    }
  }

  return { status: overallStatus, alerts };
}

module.exports = { checkThresholds, THRESHOLDS };
