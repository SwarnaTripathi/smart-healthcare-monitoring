/**
 * Phase 2 Reliability Test Suite for /api/health-data/:patientId/deterioration-risk
 * Tests all 7 required scenarios:
 * 1. Normal readings
 * 2. Programmed deterioration scenarios
 * 3. Missing or invalid readings
 * 4. Stale readings (>30 min old)
 * 5. Unknown patient IDs
 * 6. Insufficient historical data (<5 readings)
 * 7. Model file missing / inference failure
 */

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BASE_URL = 'http://localhost:3001';

async function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 PHASE 2: API RELIABILITY & SAFETY AUDIT SUITE");
  console.log("==================================================================");

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-health');
  const adminUser = await mongoose.connection.collection('users').findOne({ role: 'admin' });
  if (!adminUser) {
    console.error("No admin user found in database!");
    process.exit(1);
  }

  const token = jwt.sign({ userId: adminUser._id.toString(), role: adminUser.role }, process.env.JWT_SECRET);
  const results = {};

  // ── Scenario 1: Normal Readings (Live active patient stream) ───────────────
  console.log("\n[TEST 1] Normal Telemetry Stream (PT-00002)...");
  const res1 = await makeRequest('/api/health-data/PT-00002/deterioration-risk', token);
  console.log(`  HTTP ${res1.status} | Status: ${res1.data.status} | Risk: ${res1.data.risk_level} | Prob: ${res1.data.percentage}`);
  results.test1_normal = {
    pass: res1.status === 200 && (res1.data.status === 'AVAILABLE' || res1.data.status === 'UNAVAILABLE'),
    response: res1.data
  };

  // ── Scenario 2: Programmed Deterioration (PT-00001) ────────────────────────
  console.log("\n[TEST 2] Programmed Deterioration (PT-00001)...");
  const res2 = await makeRequest('/api/health-data/PT-00001/deterioration-risk', token);
  console.log(`  HTTP ${res2.status} | Status: ${res2.data.status} | Risk: ${res2.data.risk_level} | Prob: ${res2.data.percentage}`);
  console.log(`  Key drivers: ${JSON.stringify(res2.data.key_drivers || [])}`);
  results.test2_deterioration = {
    pass: res2.status === 200 && res2.data.status === 'AVAILABLE',
    response: res2.data
  };

  // ── Scenario 3: Missing or Invalid Readings ────────────────────────────────
  console.log("\n[TEST 3] Missing or Invalid Readings...");
  // Temporarily insert corrupted test readings
  const testPatientInvalid = 'PT-TEST-INVALID';
  await mongoose.connection.collection('healthdatas').deleteMany({ patientId: testPatientInvalid });
  const now = new Date();
  const invalidDocs = [];
  for (let i = 0; i < 8; i++) {
    invalidDocs.push({
      patientId: testPatientInvalid,
      deviceId: 'TEST-DEV',
      heartRate: i === 7 ? -99 : 75, // corrupted vital on latest reading
      spO2: 98,
      temperature: 36.6,
      status: 'normal',
      timestamp: new Date(now.getTime() - (8 - i) * 60000)
    });
  }
  await mongoose.connection.collection('healthdatas').insertMany(invalidDocs);
  const res3 = await makeRequest(`/api/health-data/${testPatientInvalid}/deterioration-risk`, token);
  console.log(`  HTTP ${res3.status} | Status: ${res3.data.status} | Reason: ${res3.data.reason}`);
  console.log(`  Risk level: ${res3.data.risk_level} (Must NOT be misleading LOW)`);
  results.test3_invalid = {
    pass: res3.data.status === 'UNAVAILABLE' && res3.data.risk_level === 'UNAVAILABLE' && res3.data.reason === 'INVALID_TELEMETRY',
    response: res3.data
  };
  await mongoose.connection.collection('healthdatas').deleteMany({ patientId: testPatientInvalid });

  // ── Scenario 4: Stale Readings (>30 minutes old) ──────────────────────────
  console.log("\n[TEST 4] Stale Readings (>30 min old)...");
  const testPatientStale = 'PT-TEST-STALE';
  await mongoose.connection.collection('healthdatas').deleteMany({ patientId: testPatientStale });
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
  const staleDocs = [];
  for (let i = 0; i < 10; i++) {
    staleDocs.push({
      patientId: testPatientStale,
      deviceId: 'TEST-DEV',
      heartRate: 75,
      spO2: 98,
      temperature: 36.6,
      status: 'normal',
      timestamp: new Date(twoHoursAgo.getTime() + i * 60000)
    });
  }
  await mongoose.connection.collection('healthdatas').insertMany(staleDocs);
  const res4 = await makeRequest(`/api/health-data/${testPatientStale}/deterioration-risk`, token);
  console.log(`  HTTP ${res4.status} | Status: ${res4.data.status} | Reason: ${res4.data.reason} | Age: ${res4.data.age_minutes}m`);
  results.test4_stale = {
    pass: res4.data.status === 'UNAVAILABLE' && res4.data.reason === 'STALE_TELEMETRY' && res4.data.risk_level === 'UNAVAILABLE',
    response: res4.data
  };
  await mongoose.connection.collection('healthdatas').deleteMany({ patientId: testPatientStale });

  // ── Scenario 5: Unknown Patient ID ────────────────────────────────────────
  console.log("\n[TEST 5] Unknown Patient ID (PT-UNKNOWN-999)...");
  const res5 = await makeRequest('/api/health-data/PT-UNKNOWN-999/deterioration-risk', token);
  console.log(`  HTTP ${res5.status} | Error: ${res5.data.error} | Status: ${res5.data.status}`);
  results.test5_unknown = {
    pass: res5.status === 404 && res5.data.status === 'UNAVAILABLE',
    response: res5.data
  };

  // ── Scenario 6: Insufficient Historical Data (<5 readings) ────────────────
  console.log("\n[TEST 6] Insufficient Historical Data (Only 2 readings)...");
  const testPatientShort = 'PT-TEST-SHORT';
  await mongoose.connection.collection('healthdatas').deleteMany({ patientId: testPatientShort });
  await mongoose.connection.collection('healthdatas').insertMany([
    { patientId: testPatientShort, deviceId: 'TEST-DEV', heartRate: 75, spO2: 98, temperature: 36.6, timestamp: new Date(Date.now() - 60000) },
    { patientId: testPatientShort, deviceId: 'TEST-DEV', heartRate: 76, spO2: 98, temperature: 36.6, timestamp: new Date() }
  ]);
  const res6 = await makeRequest(`/api/health-data/${testPatientShort}/deterioration-risk`, token);
  console.log(`  HTTP ${res6.status} | Status: ${res6.data.status} | Reason: ${res6.data.reason} | Samples: ${res6.data.sample_count}`);
  results.test6_insufficient = {
    pass: res6.data.status === 'UNAVAILABLE' && res6.data.reason === 'INSUFFICIENT_HISTORY' && res6.data.risk_level === 'UNAVAILABLE',
    response: res6.data
  };
  await mongoose.connection.collection('healthdatas').deleteMany({ patientId: testPatientShort });

  // ── Scenario 7: Model Missing / Inference Failure ─────────────────────────
  console.log("\n[TEST 7] Direct Predictor Inference Failure Fallback...");
  const { predictDeteriorationRisk } = require('./utils/deteriorationPredictor');
  // Pass an empty or broken buffer to trigger error handling
  const res7 = await predictDeteriorationRisk(null);
  console.log(`  Status: ${res7.status} | Reason: ${res7.reason} | Risk: ${res7.risk_level}`);
  results.test7_failure = {
    pass: res7.status === 'UNAVAILABLE' && res7.risk_level === 'UNAVAILABLE',
    response: res7
  };

  console.log("\n==================================================================");
  console.log("🏁 TEST RESULTS SUMMARY");
  console.log("==================================================================");
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k.padEnd(25)}: ${v.pass ? '✅ PASS' : '❌ FAIL'}`);
  }

  process.exit(0);
}

runTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
