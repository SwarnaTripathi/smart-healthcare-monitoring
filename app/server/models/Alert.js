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
    required: true,
    maxlength: 1000
  },
  value: {
    type: Number,
    default: 0
  },
  threshold: {
    type: String,
    default: '',
    maxlength: 100
  },
  status: {
    type: String,
    enum: ['open', 'acknowledged', 'resolved'],
    default: 'open',
    index: true
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
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolutionReason: {
    type: String,
    default: ''
  },
  ruleId: {
    type: String,
    default: 'RULE_GENERAL_THRESHOLD'
  },
  source: {
    type: String,
    enum: ['rule_based', 'statistical_trend', 'baseline_deviation', 'ml_model'],
    default: 'rule_based'
  },
  confidence: {
    type: String,
    enum: ['high', 'moderate', 'low', 'uncertain'],
    default: 'high'
  },
  explanation: {
    type: String,
    default: ''
  },
  supportingReadings: [{
    timestamp: { type: Date },
    value: { type: Number },
    metric: { type: String }
  }],
  baselineContext: {
    available: { type: Boolean, default: false },
    mean: { type: Number },
    stdDev: { type: Number },
    sampleSize: { type: Number },
    reason: { type: String, default: '' }
  },
  demonstrationDisclaimer: {
    type: String,
    default: 'Demonstration only: not clinically validated for diagnostic decision-making.'
  }
}, {
  timestamps: true
});

alertSchema.index({ createdAt: -1 });
alertSchema.index({ patientId: 1, status: 1 });
alertSchema.index({ patientId: 1, acknowledged: 1 });
alertSchema.index({ patientId: 1, metric: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
