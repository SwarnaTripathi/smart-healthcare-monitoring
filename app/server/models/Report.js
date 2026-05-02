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
  mimeType: { type: String, default: '' }
}, { timestamps: true });

reportSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
