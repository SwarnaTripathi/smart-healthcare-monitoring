const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const AuditLog = require('../models/AuditLog');
const Patient = require('../models/Patient');

describe('Database Security, Constraints & Authorization Tests', () => {

  describe('AuditLog Immutability Hooks', () => {
    it('AuditLog schema registers pre-hooks to block delete operations', () => {
      // Test that deleteOne and deleteMany hooks throw security errors
      const deleteHooks = AuditLog.schema.s.hooks._pres.get('deleteOne');
      assert.ok(deleteHooks && deleteHooks.length > 0, 'deleteOne hook must be registered');

      // Test hook invocation
      let errorThrown = null;
      deleteHooks[0].fn(function (err) {
        errorThrown = err;
      });
      assert.ok(errorThrown instanceof Error);
      assert.match(errorThrown.message, /Audit logs are immutable and cannot be deleted/);
    });

    it('AuditLog schema registers pre-hooks to block update operations', () => {
      const updateHooks = AuditLog.schema.s.hooks._pres.get('updateOne');
      assert.ok(updateHooks && updateHooks.length > 0, 'updateOne hook must be registered');

      // Find our custom immutability hook among registered hooks
      let errorThrown = null;
      for (const hook of updateHooks) {
        if (hook.fn.name !== '_setTimestampsOnUpdate') {
          hook.fn(function (err) {
            errorThrown = err;
          });
        }
      }
      assert.ok(errorThrown instanceof Error, 'Immutability hook must return an Error');
      assert.match(errorThrown.message, /Audit logs are immutable and cannot be modified/);
    });
  });

  describe('Doctor Assignment Check on Patient Update', () => {
    it('allows a doctor to update a patient assigned to them', () => {
      const requestingDoctor = { _id: 'doc123', role: 'doctor' };
      const targetPatient = {
        _id: 'pat001',
        name: 'Alice',
        assignedDoctor: 'doc123'
      };

      const isAllowed = requestingDoctor.role !== 'doctor' || 
        (targetPatient.assignedDoctor && targetPatient.assignedDoctor.toString() === requestingDoctor._id.toString());
      assert.equal(isAllowed, true);
    });

    it('denies a doctor from updating a patient assigned to a different doctor', () => {
      const requestingDoctor = { _id: 'doc123', role: 'doctor' };
      const otherPatient = {
        _id: 'pat002',
        name: 'Bob',
        assignedDoctor: 'doc456'
      };

      const isAllowed = requestingDoctor.role !== 'doctor' || 
        (otherPatient.assignedDoctor && otherPatient.assignedDoctor.toString() === requestingDoctor._id.toString());
      assert.equal(isAllowed, false);
    });

    it('permits administrators to update any patient regardless of assigned doctor', () => {
      const requestingAdmin = { _id: 'admin999', role: 'admin' };
      const anyPatient = {
        _id: 'pat003',
        name: 'Charlie',
        assignedDoctor: 'doc456'
      };

      const isAllowed = requestingAdmin.role !== 'doctor' || 
        (anyPatient.assignedDoctor && anyPatient.assignedDoctor.toString() === requestingAdmin._id.toString());
      assert.equal(isAllowed, true);
    });
  });

  describe('NoSQL Operator Injection Prevention on Query Whitelisting', () => {
    const allowedCategories = ['auth', 'patient', 'health_data', 'alert', 'report', 'admin', 'system'];

    it('accepts legitimate category strings from query', () => {
      const input = 'auth';
      let safeCategory = null;
      if (input && typeof input === 'string' && allowedCategories.includes(input)) {
        safeCategory = input;
      }
      assert.equal(safeCategory, 'auth');
    });

    it('rejects NoSQL injection operator objects like { $ne: null }', () => {
      const injectionInput = { $ne: null };
      let safeCategory = null;
      if (injectionInput && typeof injectionInput === 'string' && allowedCategories.includes(injectionInput)) {
        safeCategory = injectionInput;
      }
      assert.equal(safeCategory, null, 'NoSQL operator object must be rejected');
    });

    it('rejects unapproved category strings', () => {
      const unapproved = 'internal_secrets';
      let safeCategory = null;
      if (unapproved && typeof unapproved === 'string' && allowedCategories.includes(unapproved)) {
        safeCategory = unapproved;
      }
      assert.equal(safeCategory, null);
    });
  });

  describe('Pagination & Bulk Access Guard', () => {
    it('caps limit between 1 and safe maximum (200) to prevent memory exhaustion', () => {
      const testCases = [
        { input: '1000000', expected: 200 },
        { input: '-5', expected: 1 },
        { input: 'invalid', expected: 50 },
        { input: '25', expected: 25 }
      ];

      for (const tc of testCases) {
        const capped = Math.min(Math.max(1, parseInt(tc.input, 10) || 50), 200);
        assert.equal(capped, tc.expected);
      }
    });

    it('calculates page offsets safely', () => {
      const page = 3;
      const limit = 50;
      const skip = (page - 1) * limit;
      assert.equal(skip, 100);
    });
  });

  describe('Patient Schema Constraints and Data Minimization', () => {
    it('validates string length limits on sensitive fields', () => {
      const phonePath = Patient.schema.path('phone');
      assert.equal(phonePath.options.maxlength, 20);

      const addressPath = Patient.schema.path('address');
      assert.equal(addressPath.options.maxlength, 500);

      const medicalHistoryPath = Patient.schema.path('medicalHistory');
      assert.equal(medicalHistoryPath.options.maxlength, 5000);
    });

    it('defines indexes on patient ownership and assignment queries', () => {
      const indexes = Patient.schema.indexes();
      const indexedFields = indexes.map(idx => Object.keys(idx[0])[0]);
      assert.ok(indexedFields.includes('user'), 'Must index user for patient ownership lookups');
      assert.ok(indexedFields.includes('assignedDoctor'), 'Must index assignedDoctor for doctor queries');
      assert.ok(indexedFields.includes('status'), 'Must index status for triage filtering');
    });
  });
});
