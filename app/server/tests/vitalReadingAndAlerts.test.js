const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateVitalReading, PHYSIOLOGICAL_BOUNDS } = require('../utils/vitalValidator');
const {
  _slope,
  _rSquared,
  _checkSustained,
  THRESHOLDS,
  DEMONSTRATION_DISCLAIMER
} = require('../utils/alertChecker');

describe('Vital Reading Validation, Trend Analysis & Alert Attribution Tests', () => {

  describe('1. Missing, Null and Non-Fabricated Data Detection', () => {
    it('rejects payloads missing heartRate without fabricating a default value', () => {
      const payload = { patientId: 'PT-00001', spO2: 98, temperature: 36.8 };
      const res = validateVitalReading(payload);
      assert.equal(res.isValid, false);
      assert.ok(res.errors.some(e => e.includes("Missing vital reading field 'heartRate'")));
      assert.equal(res.sanitized, null, 'Must never produce a sanitized reading when fields are missing');
    });

    it('rejects payloads missing spO2 without assuming normal saturation', () => {
      const payload = { patientId: 'PT-00001', heartRate: 72, temperature: 36.8 };
      const res = validateVitalReading(payload);
      assert.equal(res.isValid, false);
      assert.ok(res.errors.some(e => e.includes("Missing vital reading field 'spO2'")));
    });

    it('rejects non-numeric values for vital signs', () => {
      const payload = { patientId: 'PT-00001', heartRate: 'abnormal', spO2: 98, temperature: 36.8 };
      const res = validateVitalReading(payload);
      assert.equal(res.isValid, false);
      assert.ok(res.errors.some(e => e.includes("Invalid non-numeric value for 'heartRate'")));
    });
  });

  describe('2. Unphysiologic & Sensor Error Detection', () => {
    it('rejects zero or negative SpO2 as sensor disconnection rather than physiological value', () => {
      const zeroSpO2 = { patientId: 'PT-00001', heartRate: 75, spO2: 0, temperature: 36.8 };
      const resZero = validateVitalReading(zeroSpO2);
      assert.equal(resZero.isValid, false);
      assert.ok(resZero.errors.some(e => e.includes('outside plausible bounds')));

      const negativeSpO2 = { patientId: 'PT-00001', heartRate: 75, spO2: -5, temperature: 36.8 };
      const resNeg = validateVitalReading(negativeSpO2);
      assert.equal(resNeg.isValid, false);
    });

    it('rejects heart rate below 20 or above 260 bpm as unphysiologic sensor failure', () => {
      const lowHR = { patientId: 'PT-00001', heartRate: 5, spO2: 98, temperature: 36.8 };
      const resLow = validateVitalReading(lowHR);
      assert.equal(resLow.isValid, false);
      assert.ok(resLow.errors.some(e => e.includes('outside plausible physiological bounds')));

      const highHR = { patientId: 'PT-00001', heartRate: 350, spO2: 98, temperature: 36.8 };
      const resHigh = validateVitalReading(highHR);
      assert.equal(resHigh.isValid, false);
    });

    it('rejects ambient thermal readings (e.g. 20°C) indicating detached probe', () => {
      const detachedTemp = { patientId: 'PT-00001', heartRate: 75, spO2: 98, temperature: 21.5 };
      const res = validateVitalReading(detachedTemp);
      assert.equal(res.isValid, false);
      assert.ok(res.errors.some(e => e.includes('Body temperature 21.5°C is outside plausible human physiological bounds')));
    });
  });

  describe('3. Duplicate, Stale and Noise / Artifact Detection', () => {
    it('detects duplicate readings received in rapid succession', () => {
      const now = Date.now();
      const lastReading = {
        heartRate: 72,
        spO2: 98,
        temperature: 36.6,
        timestamp: new Date(now)
      };
      const current = {
        patientId: 'PT-00001',
        heartRate: 72,
        spO2: 98,
        temperature: 36.6,
        timestamp: new Date(now + 200) // 200ms later, identical
      };

      const res = validateVitalReading(current, lastReading);
      assert.equal(res.isValid, true);
      assert.equal(res.isDuplicate, true);
    });

    it('detects stale telemetry readings older than 5 minutes', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const current = {
        patientId: 'PT-00001',
        heartRate: 72,
        spO2: 98,
        temperature: 36.6,
        timestamp: tenMinutesAgo
      };

      const res = validateVitalReading(current);
      assert.equal(res.isValid, true);
      assert.equal(res.isStale, true);
      assert.ok(res.warnings.some(w => w.includes('Stale telemetry reading')));
    });

    it('detects high-delta motion artifacts (e.g. 60 bpm spike in 2 seconds)', () => {
      const now = Date.now();
      const lastReading = {
        heartRate: 70,
        spO2: 98,
        temperature: 36.6,
        timestamp: new Date(now - 2000)
      };
      const noisyCurrent = {
        patientId: 'PT-00001',
        heartRate: 130, // +60 bpm in 2s (30 bpm/s > 15 bpm/s limit)
        spO2: 98,
        temperature: 36.6,
        timestamp: new Date(now)
      };

      const res = validateVitalReading(noisyCurrent, lastReading);
      assert.equal(res.isValid, true);
      assert.equal(res.isNoisy, true);
      assert.ok(res.warnings.some(w => w.includes('likely motion artifact')));
    });
  });

  describe('4. Sustained-Change vs Transient Spike Logic', () => {
    it('identifies single transient spike as not meeting sustained abnormal criteria', () => {
      // Recent readings: [normal, normal, normal]
      const recent = [
        { heartRate: 72 },
        { heartRate: 70 },
        { heartRate: 74 }
      ];
      const isWarning = v => v > 120;
      const { sustained, count } = _checkSustained(recent, 'heartRate', isWarning, 2);
      assert.equal(sustained, false);
      assert.equal(count, 0);
    });

    it('identifies consecutive abnormal readings as meeting sustained change criteria', () => {
      // Recent readings: [abnormal, abnormal, normal]
      const recent = [
        { heartRate: 125 },
        { heartRate: 128 },
        { heartRate: 70 }
      ];
      const isWarning = v => v > 120;
      const { sustained, count } = _checkSustained(recent, 'heartRate', isWarning, 2);
      assert.equal(sustained, true);
      assert.equal(count, 2);
    });
  });

  describe('5. Trend Goodness-of-Fit and Uncertainty Estimation', () => {
    it('returns high R² (>= 0.9) for highly linear deteriorating trend', () => {
      const linearSpO2 = [99, 98, 97, 96, 95, 94];
      const slope = _slope(linearSpO2);
      const r2 = _rSquared(linearSpO2, slope);
      assert.ok(r2 >= 0.95, `Expected R² >= 0.95, got ${r2}`);
    });

    it('returns low R² (< 0.5) for noisy / oscillating data indicating high uncertainty', () => {
      const noisyData = [95, 98, 94, 99, 93, 97];
      const slope = _slope(noisyData);
      const r2 = _rSquared(noisyData, slope);
      assert.ok(r2 < 0.5, `Expected low R² on oscillating noise, got ${r2}`);
    });
  });

  describe('6. Demonstration Disclaimers & Configurable Thresholds', () => {
    it('verifies explicit demonstration disclaimer is provided', () => {
      assert.ok(typeof DEMONSTRATION_DISCLAIMER === 'string');
      assert.match(DEMONSTRATION_DISCLAIMER, /not clinically validated/i);
    });

    it('verifies threshold hierarchy is consistent and configurable', () => {
      assert.ok(THRESHOLDS.heartRate.critical.min < THRESHOLDS.heartRate.warning.min);
      assert.ok(THRESHOLDS.heartRate.warning.max < THRESHOLDS.heartRate.critical.max);
      assert.ok(THRESHOLDS.temperature.critical.min < THRESHOLDS.temperature.warning.min);
      assert.ok(THRESHOLDS.temperature.warning.max < THRESHOLDS.temperature.critical.max);
    });
  });
});
