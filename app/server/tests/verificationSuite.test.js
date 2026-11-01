const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const User = require('../models/User');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');

const mongoose = require('mongoose');
const connectDB = require('../config/db');

describe('Security & Lifecycle Verification Suite (Requirements 2–8)', () => {
  let server;
  let baseUrl;
  let patientUser;
  let doctorUser;
  let patientRecordA;
  let patientRecordB;

  before(async () => {
    await connectDB();

    // Create ephemeral test users for RBAC token verification
    await User.deleteMany({ email: /@test-e2e\.internal$/ });
    await Patient.deleteMany({ deviceId: { $in: ['DEV-E2E-A', 'DEV-E2E-B'] } });

    patientUser = await User.create({
      name: 'E2E Test Patient',
      email: 'patient@test-e2e.internal',
      password: 'SecurePassword2026!',
      role: 'patient'
    });

    doctorUser = await User.create({
      name: 'E2E Test Doctor',
      email: 'doctor@test-e2e.internal',
      password: 'SecurePassword2026!',
      role: 'doctor'
    });

    // Create test patient records (Record A owned by patientUser, Record B owned by another user)
    patientRecordA = await Patient.create({
      name: 'E2E Patient A',
      age: 29,
      gender: 'Female',
      user: patientUser._id,
      deviceId: 'DEV-E2E-A'
    });

    patientRecordB = await Patient.create({
      name: 'E2E Patient B',
      age: 45,
      gender: 'Male',
      user: new mongoose.Types.ObjectId(),
      deviceId: 'DEV-E2E-B'
    });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    try {
      await User.deleteMany({ email: /@test-e2e\.internal$/ });
      await Patient.deleteMany({ deviceId: { $in: ['DEV-E2E-A', 'DEV-E2E-B'] } });
    } catch (_) {}
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  describe('Requirement 2: Unauthenticated Access Control', () => {
    it('rejects unauthenticated GET /api/patients with 401', async () => {
      const res = await fetch(`${baseUrl}/api/patients`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /No token provided/i);
    });

    it('rejects unauthenticated GET /api/alerts with 401', async () => {
      const res = await fetch(`${baseUrl}/api/alerts`);
      assert.equal(res.status, 401);
    });

    it('rejects unauthenticated GET /api/admin/users with 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`);
      assert.equal(res.status, 401);
    });

    it('rejects IoT ingest POST /api/health-data when X-Device-Key is missing with 401', async () => {
      const res = await fetch(`${baseUrl}/api/health-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: 'PT-00001', heartRate: 75, spO2: 98, temperature: 36.6 })
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /Invalid or missing device API key/i);
    });
  });

  describe("Requirement 3: Patient Record Access Control & IDOR Prevention", () => {
    it("allows a patient to access their own record by ID", async () => {
      const patientToken = jwt.sign(
        { userId: patientUser._id, role: 'patient' },
        process.env.JWT_SECRET
      );
      const res = await fetch(`${baseUrl}/api/patients/${patientRecordA._id}`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.patient.name, 'E2E Patient A');
    });

    it("rejects patient from accessing another patient's record by changing ID (IDOR)", async () => {
      const patientToken = jwt.sign(
        { userId: patientUser._id, role: 'patient' },
        process.env.JWT_SECRET
      );
      const res = await fetch(`${baseUrl}/api/patients/${patientRecordB._id}`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Access denied/i);
    });

    it("restricts bulk patient list to only the authenticated patient's own record", async () => {
      const patientToken = jwt.sign(
        { userId: patientUser._id, role: 'patient' },
        process.env.JWT_SECRET
      );
      const res = await fetch(`${baseUrl}/api/patients`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.patients));
      const ids = data.patients.map(p => p._id.toString());
      assert.ok(ids.includes(patientRecordA._id.toString()), 'Must contain owned record');
      assert.ok(!ids.includes(patientRecordB._id.toString()), 'Must not contain unauthorized record');
    });
  });

  describe('Requirement 4: Role-Based Privilege Escalation Prevention', () => {
    it('prevents a patient user from accessing admin endpoints (GET /api/admin/users)', async () => {
      const patientToken = jwt.sign(
        { userId: patientUser._id, role: 'patient' },
        process.env.JWT_SECRET
      );

      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Required role: admin/i);
    });

    it('prevents a doctor from accessing admin audit logs (GET /api/admin/audit-logs)', async () => {
      const doctorToken = jwt.sign(
        { userId: doctorUser._id, role: 'doctor' },
        process.env.JWT_SECRET
      );

      const res = await fetch(`${baseUrl}/api/admin/audit-logs`, {
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Required role: admin/i);
    });
  });

  describe('Requirement 5: Safe Input Validation & Malformed Payload Rejection', () => {
    it('rejects payloads missing vital fields on ingest without fabricating data', async () => {
      const deviceKey = process.env.DEVICE_API_KEY || 'cfa9972e0f9d2cf9d369e2558abdc26e9e614fd13e977732799b3dd4db03c062';
      const res = await fetch(`${baseUrl}/api/health-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Key': deviceKey
        },
        body: JSON.stringify({ patientId: 'PT-00001', heartRate: 75 }) // missing spO2 and temperature
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes("Missing vital reading field 'spO2'"));
    });

    it('rejects unphysiologic sensor disconnect values (SpO2: 0%) safely', async () => {
      const deviceKey = process.env.DEVICE_API_KEY || 'cfa9972e0f9d2cf9d369e2558abdc26e9e614fd13e977732799b3dd4db03c062';
      const res = await fetch(`${baseUrl}/api/health-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Key': deviceKey
        },
        body: JSON.stringify({
          patientId: 'PT-00001',
          heartRate: 75,
          spO2: 0,
          temperature: 36.6
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /outside plausible bounds/i);
    });

    it('rejects registration with weak passwords failing complexity policy', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Attacker',
          email: 'test_weak_pass@example.com',
          password: 'weak' // fails length and complexity
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Password must be/i);
    });
  });

  describe('Requirement 6: Masking of Passwords, Tokens and Secrets', () => {
    it('ensures User toJSON() strips password hash from output', () => {
      const user = new User({
        name: 'Doctor Who',
        email: 'docwho@hospital.internal',
        password: 'TemporaryValidPass1!',
        role: 'doctor'
      });

      const json = user.toJSON();
      assert.equal(json.password, undefined, 'Password must never be present in serialized JSON');
      assert.equal(json.name, 'Doctor Who');
      assert.equal(json.email, 'docwho@hospital.internal');
    });

    it('ensures error responses do not leak database connection URIs or stack traces', async () => {
      // Intentionally cause error by querying non-existent path
      const res = await fetch(`${baseUrl}/api/non-existent-endpoint`);
      assert.equal(res.status, 404);
      const text = await res.text();
      assert.ok(!text.includes('mongodb://'), 'Must never leak MongoDB URI in responses');
      assert.ok(!text.includes(process.env.JWT_SECRET), 'Must never leak JWT_SECRET in responses');
    });
  });

  describe('Requirement 7: Audit Event Generation for Security-Sensitive Actions', () => {
    it('generates an immutable audit event upon user authentication', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'patient@test-e2e.internal',
          password: 'SecurePassword2026!'
        })
      });
      assert.equal(res.status, 200);

      const auditEntry = await AuditLog.findOne({
        category: 'auth',
        userId: patientUser._id
      }).sort({ createdAt: -1 });

      assert.ok(auditEntry, 'Audit log entry must be created for successful authentication');
      assert.equal(auditEntry.userRole, 'patient');
      assert.ok(auditEntry.action.includes('User logged in'));
    });
  });

  describe('Requirement 8: Explainable Alert Attribution & Data Provenance', () => {
    it('verifies that checkThresholds returns ruleId, source and demonstration disclaimer', async () => {
      const { checkThresholds } = require('../utils/alertChecker');
      const dynId = `PT-VERIF-${Date.now()}`;
      const criticalResult = await checkThresholds({
        patientId: dynId,
        patientName: 'Test Patient',
        heartRate: 165, // critical tachy
        spO2: 98,
        temperature: 36.6
      });

      assert.equal(criticalResult.status, 'critical');
      assert.ok(criticalResult.alerts.length > 0);
      const alert = criticalResult.alerts[0];

      assert.equal(alert.ruleId, 'RULE_HR_CRITICAL_HIGH');
      assert.equal(alert.source, 'rule_based');
      assert.equal(alert.confidence, 'high');
      assert.ok(alert.explanation.includes('breached critical threshold'));
      assert.ok(alert.demonstrationDisclaimer.includes('not clinically validated'));
    });
  });
});
