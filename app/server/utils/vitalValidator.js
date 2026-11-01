/**
 * Vital Reading Validation Module
 * Detects missing, unphysiologic, duplicate, stale, and noisy sensor telemetry.
 * Strictly avoids silent fabrication or assumption of missing vital values.
 */

// Physiological plausibility demonstration bounds
// Values outside these ranges indicate sensor disconnection, motion artifact, or severe malfunction.
const PHYSIOLOGICAL_BOUNDS = {
  heartRate: {
    min: 20,    // bpm - severe profound bradycardia limit
    max: 260,   // bpm - maximum plausible supraventricular tachycardia limit
    maxDeltaPerSecond: 15 // maximum plausible physiological acceleration (bpm/sec)
  },
  spO2: {
    min: 50,    // % - lowest plausible survival pulse oximetry value before probe failure
    max: 100,   // % - physical atmospheric maximum
    maxDeltaPerSecond: 5  // %/sec maximum physiological desaturation rate
  },
  temperature: {
    min: 32.0,  // °C - profound accidental hypothermia boundary
    max: 43.0,  // °C - hyperpyrexia physiological boundary
    maxDeltaPerSecond: 0.2 // °C/sec maximum plausible human thermal shift
  }
};

/**
 * Validates an incoming sensor reading payload against historical context.
 * 
 * @param {Object} current - { patientId, deviceId, heartRate, spO2, temperature, timestamp }
 * @param {Object|null} lastReading - Previous reading from database for context
 * @returns {Object} Validation result { isValid, isDuplicate, isStale, isNoisy, errors, warnings, sanitized }
 */
function validateVitalReading(current, lastReading = null) {
  const result = {
    isValid: true,
    isDuplicate: false,
    isStale: false,
    isNoisy: false,
    errors: [],
    warnings: [],
    sanitized: null
  };

  if (!current || typeof current !== 'object') {
    result.isValid = false;
    result.errors.push('Invalid payload: expected JSON object.');
    return result;
  }

  // 1. Missing fields check — never fabricate or assume missing data
  const required = ['patientId', 'heartRate', 'spO2', 'temperature'];
  for (const field of required) {
    if (current[field] === undefined || current[field] === null || current[field] === '') {
      result.isValid = false;
      result.errors.push(`Missing vital reading field '${field}'. Values will not be assumed or fabricated.`);
    } else if (field !== 'patientId' && (typeof current[field] !== 'number' || isNaN(current[field]))) {
      result.isValid = false;
      result.errors.push(`Invalid non-numeric value for '${field}'.`);
    }
  }

  if (!result.isValid) return result;

  const hr   = Number(current.heartRate);
  const spo2 = Number(current.spO2);
  const temp = Number(current.temperature);
  const now  = Date.now();
  const currentTs = current.timestamp ? new Date(current.timestamp).getTime() : now;

  // 2. Unphysiologic / sensor error boundaries
  if (hr < PHYSIOLOGICAL_BOUNDS.heartRate.min || hr > PHYSIOLOGICAL_BOUNDS.heartRate.max) {
    result.isValid = false;
    result.errors.push(
      `Heart rate ${hr} bpm is outside plausible physiological bounds (${PHYSIOLOGICAL_BOUNDS.heartRate.min}–${PHYSIOLOGICAL_BOUNDS.heartRate.max} bpm). Possible sensor disconnect or optical artifact.`
    );
  }

  if (spo2 < PHYSIOLOGICAL_BOUNDS.spO2.min || spo2 > PHYSIOLOGICAL_BOUNDS.spO2.max) {
    result.isValid = false;
    result.errors.push(
      `SpO2 reading ${spo2}% is outside plausible bounds (${PHYSIOLOGICAL_BOUNDS.spO2.min}–${PHYSIOLOGICAL_BOUNDS.spO2.max}%). Sensor displacement or perfusion loss detected.`
    );
  }

  if (temp < PHYSIOLOGICAL_BOUNDS.temperature.min || temp > PHYSIOLOGICAL_BOUNDS.temperature.max) {
    result.isValid = false;
    result.errors.push(
      `Body temperature ${temp}°C is outside plausible human physiological bounds (${PHYSIOLOGICAL_BOUNDS.temperature.min}–${PHYSIOLOGICAL_BOUNDS.temperature.max}°C). Probe displacement or ambient exposure detected.`
    );
  }

  if (!result.isValid) return result;

  // 3. Stale reading detection (older than 5 minutes)
  if (now - currentTs > 5 * 60 * 1000) {
    result.isStale = true;
    result.warnings.push(`Stale telemetry reading: timestamp is ${Math.round((now - currentTs) / 1000)}s in the past.`);
  }

  // 4. Duplicate and Noise detection using last reading context
  if (lastReading) {
    const lastTs = new Date(lastReading.timestamp).getTime();
    const dtSeconds = Math.max(0.5, (currentTs - lastTs) / 1000);

    // Duplicate packet check (exact same metrics within 1 second or back-to-back zero delta)
    const isExactMatch =
      lastReading.heartRate === hr &&
      lastReading.spO2 === spo2 &&
      lastReading.temperature === temp;

    if (isExactMatch && (currentTs === lastTs || dtSeconds < 1.0)) {
      result.isDuplicate = true;
      result.warnings.push('Duplicate sensor reading received within short deduplication interval.');
    }

    // Motion artifact / noise detection: single-cycle biologically implausible delta
    const deltaHR   = Math.abs(hr - lastReading.heartRate);
    const deltaSpO2 = Math.abs(spo2 - lastReading.spO2);
    const deltaTemp = Math.abs(temp - lastReading.temperature);

    const hrRate   = deltaHR / dtSeconds;
    const spo2Rate = deltaSpO2 / dtSeconds;
    const tempRate = deltaTemp / dtSeconds;

    if (dtSeconds <= 10) {
      if (hrRate > PHYSIOLOGICAL_BOUNDS.heartRate.maxDeltaPerSecond) {
        result.isNoisy = true;
        result.warnings.push(
          `High-frequency delta on heart rate (${deltaHR} bpm in ${dtSeconds.toFixed(1)}s): likely motion artifact.`
        );
      }
      if (spo2Rate > PHYSIOLOGICAL_BOUNDS.spO2.maxDeltaPerSecond) {
        result.isNoisy = true;
        result.warnings.push(
          `Rapid SpO2 drop (${deltaSpO2}% in ${dtSeconds.toFixed(1)}s): probable perfusion artifact or finger slip.`
        );
      }
      if (tempRate > PHYSIOLOGICAL_BOUNDS.temperature.maxDeltaPerSecond) {
        result.isNoisy = true;
        result.warnings.push(
          `Thermal shift rate (${deltaTemp}°C in ${dtSeconds.toFixed(1)}s) exceeds physiological response rate.`
        );
      }
    }
  }

  result.sanitized = {
    patientId: current.patientId,
    deviceId: current.deviceId || 'SIM-ESP32-001',
    heartRate: Math.round(hr),
    spO2: Math.round(spo2 * 10) / 10,
    temperature: Math.round(temp * 10) / 10,
    timestamp: new Date(currentTs),
    dataQuality: {
      isValid: result.isValid,
      isDuplicate: result.isDuplicate,
      isStale: result.isStale,
      isNoisy: result.isNoisy,
      warnings: result.warnings
    }
  };

  return result;
}

module.exports = {
  validateVitalReading,
  PHYSIOLOGICAL_BOUNDS
};
