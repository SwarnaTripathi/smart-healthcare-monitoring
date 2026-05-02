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
  status: {
    type: String,
    enum: ['normal', 'warning', 'critical'],
    default: 'normal'
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
