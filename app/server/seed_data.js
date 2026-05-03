/**
 * Synthetic Data Seeder for Smart Healthcare Monitoring System
 * 
 * Generates realistic demo data:
 *  - 3 Users (1 admin, 1 doctor, 3 patients)
 *  - 5 Patient records linked to user accounts
 *  - 7 days of health data per patient (~200 readings each)
 *  - Alerts triggered by abnormal readings
 *  - Audit logs
 * 
 * Usage: node seed_data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Patient = require('./models/Patient');
const HealthData = require('./models/HealthData');
const Alert = require('./models/Alert');
const AuditLog = require('./models/AuditLog');

// ── Configuration ───────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_healthcare';

// Number of days of historical data per patient
const DAYS_OF_DATA = 7;
// Readings per day per patient (1 reading every ~20 minutes = 72/day)
const READINGS_PER_DAY = 72;

// ── Seed Users ──────────────────────────────────────────────────

const seedUsers = [
  { name: 'Admin User',       email: 'admin@healthguard.com',    password: 'admin123',   role: 'admin'   },
  { name: 'Dr. Priya Sharma', email: 'priya@healthguard.com',    password: 'doctor123',  role: 'doctor', specialization: 'Cardiologist' },
  { name: 'Dr. Rahul Mehta',  email: 'rahul@healthguard.com',    password: 'doctor123',  role: 'doctor', specialization: 'General Physician' },
  { name: 'Amit Kumar',       email: 'amit@patient.com',         password: 'patient123', role: 'patient' },
  { name: 'Sneha Patel',      email: 'sneha@patient.com',        password: 'patient123', role: 'patient' },
  { name: 'Ravi Verma',       email: 'ravi@patient.com',         password: 'patient123', role: 'patient' },
  { name: 'Anjali Singh',     email: 'anjali@patient.com',       password: 'patient123', role: 'patient' },
  { name: 'Vikram Joshi',     email: 'vikram@patient.com',       password: 'patient123', role: 'patient' },
  // These 2 are "newly registered" — no Patient record will be created for them
  // They will appear in the "Add Patient" unlinked users list
  { name: 'Neha Gupta',       email: 'neha@patient.com',         password: 'patient123', role: 'patient' },
  { name: 'Arjun Reddy',      email: 'arjun@patient.com',        password: 'patient123', role: 'patient' },
];

// Patient profiles (will be linked to the patient users above)
const seedPatients = [
  { name: 'Amit Kumar',    age: 34, gender: 'Male',   bloodGroup: 'B+',  phone: '9876543210', address: '12 MG Road, Mumbai',        medicalHistory: 'Mild hypertension. Non-smoker. Regular exercise.',                        deviceId: 'SIM-ESP32-001' },
  { name: 'Sneha Patel',   age: 28, gender: 'Female', bloodGroup: 'A+',  phone: '9876543211', address: '45 Nehru Nagar, Pune',      medicalHistory: 'No chronic conditions. Allergic to penicillin.',                         deviceId: 'SIM-ESP32-002' },
  { name: 'Ravi Verma',    age: 52, gender: 'Male',   bloodGroup: 'O+',  phone: '9876543212', address: '78 Gandhi Chowk, Delhi',     medicalHistory: 'Type 2 diabetes, controlled with Metformin. History of mild asthma.',     deviceId: 'SIM-ESP32-003' },
  { name: 'Anjali Singh',  age: 45, gender: 'Female', bloodGroup: 'AB-', phone: '9876543213', address: '23 Sarojini Nagar, Lucknow', medicalHistory: 'Hypothyroidism on Levothyroxine 50mcg. Vitamin D deficiency.',            deviceId: 'SIM-ESP32-004' },
  { name: 'Vikram Joshi',  age: 61, gender: 'Male',   bloodGroup: 'A-',  phone: '9876543214', address: '9 Banjara Hills, Hyderabad', medicalHistory: 'Post coronary angioplasty (2024). On Aspirin & Atorvastatin. Ex-smoker.', deviceId: 'SIM-ESP32-005' },
];

// Per-patient health profiles for realistic simulation
const healthProfiles = [
  { baseHR: 78, baseSPO2: 97.5, baseTemp: 36.6, anomalyRate: 0.04 },  // Amit – healthy young
  { baseHR: 72, baseSPO2: 98.0, baseTemp: 36.5, anomalyRate: 0.03 },  // Sneha – healthy
  { baseHR: 82, baseSPO2: 95.5, baseTemp: 36.8, anomalyRate: 0.08 },  // Ravi – diabetic/asthma
  { baseHR: 74, baseSPO2: 97.0, baseTemp: 36.7, anomalyRate: 0.05 },  // Anjali – thyroid
  { baseHR: 68, baseSPO2: 95.0, baseTemp: 36.4, anomalyRate: 0.10 },  // Vikram – cardiac
];

// ── Helpers ──────────────────────────────────────────────────────

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function gauss(mean, std) {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function determineStatus(hr, spo2, temp) {
  let status = 'normal';
  // Critical thresholds
  if (hr < 40 || hr > 150 || spo2 < 90 || temp < 35 || temp > 39.5) status = 'critical';
  else if (hr < 50 || hr > 120 || spo2 < 94 || temp < 36 || temp > 38) status = 'warning';
  return status;
}

function generateReading(profile, t) {
  const hrVar = Math.sin(t * 0.05) * 5 + gauss(0, 2);
  const spo2Var = Math.sin(t * 0.03) * 0.8 + gauss(0, 0.3);
  const tempVar = Math.sin(t * 0.02) * 0.2 + gauss(0, 0.05);

  let hr = Math.round(profile.baseHR + hrVar);
  let spo2 = +(profile.baseSPO2 + spo2Var).toFixed(1);
  let temp = +(profile.baseTemp + tempVar).toFixed(1);

  // Anomaly injection
  if (Math.random() < profile.anomalyRate) {
    const type = ['high_hr', 'low_hr', 'low_spo2', 'high_temp'][randInt(0, 3)];
    if (type === 'high_hr')    hr = randInt(125, 160);
    if (type === 'low_hr')     hr = randInt(38, 48);
    if (type === 'low_spo2')   spo2 = +(rand(85, 92)).toFixed(1);
    if (type === 'high_temp')  temp = +(rand(38.5, 40.5)).toFixed(1);
  }

  hr = clamp(hr, 35, 180);
  spo2 = clamp(spo2, 80, 100);
  temp = clamp(temp, 34, 42);

  return { heartRate: hr, spO2: spo2, temperature: temp };
}

function buildAlerts(patientId, patientName, hr, spo2, temp) {
  const alerts = [];
  // Heart rate
  if (hr < 40 || hr > 150) {
    alerts.push({ patientId, patientName, type: 'critical', metric: 'heartRate', message: `CRITICAL: Heart rate is ${hr} bpm (Normal: 60-100 bpm)`, value: hr, threshold: '40-150 bpm' });
  } else if (hr < 50 || hr > 120) {
    alerts.push({ patientId, patientName, type: 'warning', metric: 'heartRate', message: `WARNING: Heart rate is ${hr} bpm (Normal: 60-100 bpm)`, value: hr, threshold: '50-120 bpm' });
  }
  // SpO2
  if (spo2 < 90) {
    alerts.push({ patientId, patientName, type: 'critical', metric: 'spO2', message: `CRITICAL: SpO2 is ${spo2}% (Normal: 95-100%)`, value: spo2, threshold: '> 90%' });
  } else if (spo2 < 94) {
    alerts.push({ patientId, patientName, type: 'warning', metric: 'spO2', message: `WARNING: SpO2 is ${spo2}% (Normal: 95-100%)`, value: spo2, threshold: '> 94%' });
  }
  // Temperature
  if (temp < 35 || temp > 39.5) {
    alerts.push({ patientId, patientName, type: 'critical', metric: 'temperature', message: `CRITICAL: Temperature is ${temp}°C (Normal: 36.1-37.2°C)`, value: temp, threshold: '35.0-39.5°C' });
  } else if (temp < 36 || temp > 38) {
    alerts.push({ patientId, patientName, type: 'warning', metric: 'temperature', message: `WARNING: Temperature is ${temp}°C (Normal: 36.1-37.2°C)`, value: temp, threshold: '36.0-38.0°C' });
  }
  return alerts;
}

// ── Main Seeder ─────────────────────────────────────────────────

async function seed() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     Smart Healthcare — Synthetic Data Seeder        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.connect(MONGODB_URI);
  console.log(`✓ Connected to MongoDB: ${MONGODB_URI}\n`);

  // ── Step 1: Clear existing data ──
  console.log('🗑  Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    HealthData.deleteMany({}),
    Alert.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('   Done.\n');

  // ── Step 2: Create Users ──
  console.log('👤 Creating users...');
  const createdUsers = [];
  for (const u of seedUsers) {
    const user = new User(u);
    await user.save();
    createdUsers.push(user);
    console.log(`   ✓ ${u.role.padEnd(7)} | ${u.name.padEnd(20)} | ${u.email} | password: ${u.password}`);
  }
  console.log(`   Total: ${createdUsers.length} users\n`);

  const adminUser = createdUsers.find(u => u.role === 'admin');
  const doctors = createdUsers.filter(u => u.role === 'doctor');
  const patientUsers = createdUsers.filter(u => u.role === 'patient');

  // ── Step 3: Create Patient Records ──
  console.log('🏥 Creating patient records...');
  const createdPatients = [];
  for (let i = 0; i < seedPatients.length; i++) {
    const pData = seedPatients[i];
    const linkedUser = patientUsers[i];
    const assignedDoctor = doctors[i % doctors.length]; // round-robin assign

    const patient = new Patient({
      ...pData,
      user: linkedUser._id,
      assignedDoctor: assignedDoctor._id,
    });
    await patient.save();
    createdPatients.push(patient);
    console.log(`   ✓ ${patient.patientId} | ${patient.name.padEnd(16)} | Doctor: ${assignedDoctor.name} | User: ${linkedUser.email}`);
  }
  console.log(`   Total: ${createdPatients.length} patients\n`);

  // ── Step 4: Generate Health Data + Alerts ──
  console.log(`📊 Generating ${DAYS_OF_DATA} days of health data per patient...`);

  const now = new Date();
  let totalReadings = 0;
  let totalAlerts = 0;

  for (let pi = 0; pi < createdPatients.length; pi++) {
    const patient = createdPatients[pi];
    const profile = healthProfiles[pi];
    const healthDocs = [];
    const alertDocs = [];

    for (let day = DAYS_OF_DATA - 1; day >= 0; day--) {
      for (let r = 0; r < READINGS_PER_DAY; r++) {
        const t = (DAYS_OF_DATA - day) * READINGS_PER_DAY + r;
        const { heartRate, spO2, temperature } = generateReading(profile, t);
        const status = determineStatus(heartRate, spO2, temperature);

        // Spread readings across the day (every ~20 min)
        const timestamp = new Date(now.getTime() - day * 86400000 - (READINGS_PER_DAY - r) * 20 * 60000);

        healthDocs.push({
          patientId: patient.patientId,
          deviceId: patient.deviceId,
          heartRate,
          spO2,
          temperature,
          status,
          timestamp,
        });

        // Generate corresponding alerts
        if (status !== 'normal') {
          const alerts = buildAlerts(patient.patientId, patient.name, heartRate, spO2, temperature);
          for (const a of alerts) {
            // Some past alerts are acknowledged by doctors
            const ack = Math.random() < 0.6;
            alertDocs.push({
              ...a,
              acknowledged: ack,
              acknowledgedBy: ack ? doctors[randInt(0, doctors.length - 1)]._id : null,
              acknowledgedAt: ack ? new Date(timestamp.getTime() + randInt(5, 60) * 60000) : null,
              createdAt: timestamp,
            });
          }
        }
      }
    }

    // Bulk insert for performance
    await HealthData.insertMany(healthDocs);
    if (alertDocs.length > 0) await Alert.insertMany(alertDocs);

    totalReadings += healthDocs.length;
    totalAlerts += alertDocs.length;

    // Update patient status based on last reading
    const lastStatus = healthDocs[healthDocs.length - 1]?.status || 'active';
    patient.status = lastStatus === 'critical' ? 'critical' : 'active';
    await patient.save();

    console.log(`   ✓ ${patient.patientId} (${patient.name.padEnd(16)}) — ${healthDocs.length} readings, ${alertDocs.length} alerts`);
  }

  console.log(`\n   Total readings: ${totalReadings}`);
  console.log(`   Total alerts:   ${totalAlerts}\n`);

  // ── Step 5: Create Audit Logs ──
  console.log('📝 Creating audit logs...');
  const auditLogs = [
    { action: 'System initialized with seed data', category: 'system', userId: adminUser._id, userName: adminUser.name, userRole: 'admin', severity: 'info' },
    { action: `${createdPatients.length} patient records created`, category: 'admin', userId: adminUser._id, userName: adminUser.name, userRole: 'admin', severity: 'info' },
    { action: `${seedUsers.length} user accounts created`, category: 'admin', userId: adminUser._id, userName: adminUser.name, userRole: 'admin', severity: 'info' },
    { action: `IoT health data seeded for ${DAYS_OF_DATA} days`, category: 'system', userId: adminUser._id, userName: adminUser.name, userRole: 'admin', severity: 'info' },
  ];
  await AuditLog.insertMany(auditLogs);
  console.log(`   ✓ ${auditLogs.length} audit log entries\n`);

  // ── Summary ──
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║                    SEED COMPLETE                    ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Users:      ${String(createdUsers.length).padStart(4)}                                ║`);
  console.log(`║  Patients:   ${String(createdPatients.length).padStart(4)}                                ║`);
  console.log(`║  Readings:   ${String(totalReadings).padStart(4)}                                ║`);
  console.log(`║  Alerts:     ${String(totalAlerts).padStart(4)}                                ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Login Credentials:                                 ║');
  console.log('║  ─────────────────────────────────────────────────  ║');
  console.log('║  Admin:   admin@healthguard.com   / admin123        ║');
  console.log('║  Doctor:  priya@healthguard.com   / doctor123       ║');
  console.log('║  Doctor:  rahul@healthguard.com   / doctor123       ║');
  console.log('║  Patient: amit@patient.com        / patient123      ║');
  console.log('║  Patient: sneha@patient.com       / patient123      ║');
  console.log('║  Patient: ravi@patient.com        / patient123      ║');
  console.log('║  Patient: anjali@patient.com      / patient123      ║');
  console.log('║  Patient: vikram@patient.com      / patient123      ║');
  console.log('║                                                      ║');
  console.log('║  🆕 Unlinked (for Add Patient demo):                 ║');
  console.log('║  Patient: neha@patient.com        / patient123      ║');
  console.log('║  Patient: arjun@patient.com       / patient123      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
