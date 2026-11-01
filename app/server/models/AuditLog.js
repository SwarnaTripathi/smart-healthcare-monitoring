const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  category: { type: String, enum: ['auth', 'patient', 'health_data', 'alert', 'report', 'admin', 'system'], default: 'system' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userName: { type: String, default: '' },
  userRole: { type: String, default: '' },
  details: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' }
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

// Enforce audit log immutability: prevent deletion or modification via ORM/Mongoose
auditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function (next) {
  next(new Error('Security Violation: Audit logs are immutable and cannot be deleted.'));
});
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function (next) {
  next(new Error('Security Violation: Audit logs are immutable and cannot be modified.'));
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
