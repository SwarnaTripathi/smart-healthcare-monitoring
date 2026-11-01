const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { _slope, THRESHOLDS } = require('../utils/alertChecker');

describe('alertChecker - Trend and Regression Analytics', () => {
  it('returns slope 0 for datasets with fewer than 3 values', () => {
    assert.equal(_slope([]), 0);
    assert.equal(_slope([98]), 0);
    assert.equal(_slope([98, 97]), 0);
  });

  it('calculates zero slope for perfectly flat trends', () => {
    const flatData = [98, 98, 98, 98, 98];
    assert.equal(_slope(flatData), 0);
  });

  it('calculates negative slope for deteriorating SpO2 readings', () => {
    // Falling SpO2 from 98% down to 93% across 6 readings
    const fallingSpO2 = [98, 97, 96, 95, 94, 93];
    const slope = _slope(fallingSpO2);
    assert.ok(slope < 0, `Expected negative slope, got ${slope}`);
    assert.equal(Math.round(slope * 10) / 10, -1.0);
  });

  it('calculates positive slope for rapidly rising heart rate readings', () => {
    // Rising HR from 70 up to 95 bpm
    const risingHR = [70, 75, 80, 85, 90, 95];
    const slope = _slope(risingHR);
    assert.ok(slope > 0, `Expected positive slope, got ${slope}`);
    assert.equal(slope, 5.0);
  });

  it('verifies clinical threshold definitions are valid and ordered', () => {
    assert.ok(THRESHOLDS.heartRate.critical.min < THRESHOLDS.heartRate.warning.min);
    assert.ok(THRESHOLDS.heartRate.warning.max < THRESHOLDS.heartRate.critical.max);

    assert.ok(THRESHOLDS.spO2.critical.max < THRESHOLDS.spO2.warning.max);

    assert.ok(THRESHOLDS.temperature.critical.min < THRESHOLDS.temperature.warning.min);
    assert.ok(THRESHOLDS.temperature.warning.max < THRESHOLDS.temperature.critical.max);
  });
});
