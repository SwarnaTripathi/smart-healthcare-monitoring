const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifySeverity, analyzeReport, REFERENCE_RANGES } = require('../utils/reportAnalyzer');

describe('reportAnalyzer - Clinical Severity and Analysis', () => {
  it('classifies values within normal range as normal', () => {
    const res = classifySeverity(14.5, 13.8, 17.2, REFERENCE_RANGES.hemoglobin);
    assert.deepEqual(res, { status: 'normal', direction: 'normal' });
  });

  it('L-4: prioritizes absolute clinical criticalLow threshold over percentage logic', () => {
    // Hemoglobin criticalLow is 7.0 g/dL.
    // At 6.8 g/dL, it is only ~50% below 13.8, but clinically it represents severe acute anemia.
    const res = classifySeverity(6.8, 13.8, 17.2, REFERENCE_RANGES.hemoglobin);
    assert.equal(res.status, 'critical');
    assert.equal(res.direction, 'low');
  });

  it('L-4: prioritizes absolute clinical criticalHigh threshold (e.g. Potassium > 6.5)', () => {
    // Potassium normal [3.5, 5.0], criticalHigh: 6.5
    // At 6.8 mmol/L, it exceeds criticalHigh, representing dangerous hyperkalemia.
    const res = classifySeverity(6.8, 3.5, 5.0, REFERENCE_RANGES.potassium);
    assert.equal(res.status, 'critical');
    assert.equal(res.direction, 'high');
  });

  it('L-4: identifies severe acute systemic inflammation via CRP critical cutoff', () => {
    // CRP normal [0, 3.0], criticalHigh: 100 mg/L
    const res = classifySeverity(120, 0, 3.0, REFERENCE_RANGES.crp);
    assert.equal(res.status, 'critical');
    assert.equal(res.direction, 'high');
  });

  it('handles gender-specific reference ranges in full report analysis', () => {
    const labValues = { hemoglobin: 12.5 };

    // For a male, 12.5 is below normal (13.8 - 17.2)
    const maleAnalysis = analyzeReport(labValues, 'Male');
    assert.notEqual(maleAnalysis.details[0].status, 'normal');

    // For a female, 12.5 is normal (12.1 - 15.1)
    const femaleAnalysis = analyzeReport(labValues, 'Female');
    assert.equal(femaleAnalysis.details[0].status, 'normal');
  });

  it('correctly compiles overall summary and statistics', () => {
    const report = analyzeReport({
      glucose_fasting: 85,
      cholesterol_total: 170,
      hemoglobin: 6.0 // critical
    }, 'Male');

    assert.equal(report.overallStatus, 'critical');
    assert.equal(report.stats.critical, 1);
    assert.equal(report.stats.normal, 2);
    assert.ok(report.recommendations.length > 0);
  });
});
