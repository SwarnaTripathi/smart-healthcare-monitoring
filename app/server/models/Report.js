const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['lab_report', 'prescription', 'imaging', 'discharge_summary', 'other'],
    default: 'lab_report'
  },
  description: { type: String, default: '' },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSize: { type: Number, default: 0 },
  mimeType: { type: String, default: '' },

  // Lab values entered by the user (key-value pairs)
  labValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // AI-generated analysis based on lab values
  aiAnalysis: {
    summary: { type: String, default: '' },
    overallStatus: { type: String, enum: ['normal', 'borderline', 'abnormal', 'critical', ''], default: '' },
    findings: [{ type: String }],
    recommendations: [{
      test: String,
      severity: String,
      advice: String
    }],
    details: [{
      test: String,
      key: String,
      value: Number,
      unit: String,
      normalRange: String,
      status: String,
      direction: String
    }],
    stats: {
      total: { type: Number, default: 0 },
      normal: { type: Number, default: 0 },
      borderline: { type: Number, default: 0 },
      abnormal: { type: Number, default: 0 },
      critical: { type: Number, default: 0 }
    },
    wellnessTips: [{ type: String }],
    analyzedAt: { type: Date }
  }
}, { timestamps: true });

reportSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
