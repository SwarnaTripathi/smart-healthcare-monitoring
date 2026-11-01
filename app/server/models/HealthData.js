const mongoose = require('mongoose');

const healthDataSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    default: 'SIM-ESP32-001'
  },
  heartRate: {
    type: Number,
    required: true,
    min: 0,
    max: 300
  },
  spO2: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  temperature: {
    type: Number,
    required: true,
    min: 30,
    max: 45
  },
  // ── Extended ICU Vitals (optional — present when simulator/device provides them) ──
  respRate: {            // Respiratory Rate (breaths/min)
    type: Number,
    min: 0,
    max: 80
  },
  map: {                 // Mean Arterial Pressure (mmHg)
    type: Number,
    min: 0,
    max: 200
  },
  sysBP: {               // Systolic Blood Pressure (mmHg)
    type: Number,
    min: 0,
    max: 300
  },
  etco2: {               // End-Tidal CO₂ (mmHg)
    type: Number,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['normal', 'warning', 'critical'],
    default: 'normal'
  },
  dataQuality: {
    isValid: { type: Boolean, default: true },
    isDuplicate: { type: Boolean, default: false },
    isStale: { type: Boolean, default: false },
    isNoisy: { type: Boolean, default: false },
    warnings: [{ type: String }]
  },
  isSynthetic: {
    type: Boolean,
    default: true
  },
  syntheticProvenance: {
    type: String,
    default: 'SmartHealthcare-IoT-Simulator'
  },
  // ── ML Label Fields ────────────────────────────────────────────────────────
  // groundTruthLabel: scenario-derived label from the IoT simulator.
  // NOTE: This is a SYNTHETIC PROTOTYPE label derived from programmed scenarios,
  // NOT a real clinical outcome. Use MIMIC-IV or equivalent for clinical validity.
  groundTruthLabel: {
    type: String,
    enum: ['normal', 'warning_trend', 'critical_anomaly', 'sensor_artifact', 'invalid', 'unknown'],
    default: 'unknown',
    index: true
  },
  scenario: {
    type: String,
    default: ''   // e.g. 'normal', 'gradual_deterioration', 'sudden_spike', etc.
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
healthDataSchema.index({ patientId: 1, timestamp: -1 });

module.exports = mongoose.model('HealthData', healthDataSchema);
