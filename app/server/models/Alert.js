const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  patientName: {
    type: String,
    default: 'Unknown'
  },
  type: {
    type: String,
    enum: ['warning', 'critical'],
    required: true
  },
  metric: {
    type: String,
    enum: ['heartRate', 'spO2', 'temperature', 'multiple'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  value: {
    type: Number,
    default: 0
  },
  threshold: {
    type: String,
    default: ''
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  acknowledgedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

alertSchema.index({ createdAt: -1 });
alertSchema.index({ patientId: 1, acknowledged: 1 });

module.exports = mongoose.model('Alert', alertSchema);
