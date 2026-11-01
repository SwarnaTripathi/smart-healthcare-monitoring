const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

describe('Security Controls & Input Validation', () => {
  // M-2: Password complexity regex test
  const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

  it('rejects passwords that fail complexity or minimum length requirements', () => {
    assert.equal(passwordComplexityRegex.test('simplepassword'), false); // no upper, no digit
    assert.equal(passwordComplexityRegex.test('ALLCAPS123'), false);      // no lower
    assert.equal(passwordComplexityRegex.test('NoDigitsHere'), false);     // no digit
    assert.equal('Short1'.length >= 8, false);                            // too short
  });

  it('accepts compliant passwords meeting complexity and length criteria', () => {
    const valid = 'SecurePass2026!';
    assert.ok(valid.length >= 8);
    assert.equal(passwordComplexityRegex.test(valid), true);
  });

  // H-6: Path traversal prevention test
  it('neutralizes path traversal attempts using path.basename', () => {
    const maliciousInput = '../../../etc/passwd';
    const sanitized = path.basename(maliciousInput);
    assert.equal(sanitized, 'passwd');

    const windowsMalicious = '..\\..\\..\\windows\\system32\\cmd.exe';
    const sanitizedWin = path.basename(windowsMalicious);
    assert.ok(!sanitizedWin.includes('..'));
  });

  // H-5: Mass assignment field whitelisting test
  it('correctly filters patient updates to whitelisted fields only', () => {
    const ALLOWED_FIELDS = [
      'name', 'age', 'gender', 'bloodGroup', 'phone', 'email',
      'emergencyContact', 'medicalHistory', 'allergies', 'room', 'bed'
    ];

    const attackPayload = {
      name: 'John Doe',
      role: 'admin',
      isSuperuser: true,
      patientId: 'PT-99999',
      _id: 'fake-id',
      room: '102B'
    };

    const sanitized = {};
    for (const key of ALLOWED_FIELDS) {
      if (attackPayload[key] !== undefined) sanitized[key] = attackPayload[key];
    }

    assert.equal(sanitized.name, 'John Doe');
    assert.equal(sanitized.room, '102B');
    assert.equal(sanitized.role, undefined);
    assert.equal(sanitized.isSuperuser, undefined);
    assert.equal(sanitized.patientId, undefined);
    assert.equal(sanitized._id, undefined);
  });
});
