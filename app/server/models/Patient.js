const mongoose = require('mongoose');

// ── Counter collection for collision-safe patient IDs (M-8) ───────────────────
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq:  { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

const patientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  patientId: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 0,
    max: 150
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    default: 'O+'
  },
  phone: {
    type: String,
    default: '',
    maxlength: 20
  },
  address: {
    type: String,
    default: '',
    maxlength: 500
  },
  emergencyContact: {
    name:     { type: String, default: '', maxlength: 100 },
    phone:    { type: String, default: '', maxlength: 20 },
    relation: { type: String, default: '', maxlength: 50 }
  },
  medicalHistory: {
    type: String,
    default: '',
    maxlength: 5000
  },
  assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'discharged', 'critical'],
    default: 'active'
  },
  deviceId: {
    type: String,
    default: '',
    maxlength: 50
  }
}, {
  timestamps: true
});

// Indexes for query performance and role/assignment ownership lookup
patientSchema.index({ user: 1 });
patientSchema.index({ assignedDoctor: 1 });
patientSchema.index({ status: 1 });

// M-8: Atomic auto-increment via findOneAndUpdate with migration-safe counter seeding
patientSchema.pre('validate', async function (next) {
  if (!this.patientId) {
    let counter = await Counter.findById('patientId');
    if (!counter) {
      // Find highest existing numerical patientId suffix to seed without collisions
      const lastPatient = await mongoose.model('Patient')
        .findOne({ patientId: /^PT-\d+$/ })
        .sort({ patientId: -1 });
      let currentMax = 0;
      if (lastPatient && lastPatient.patientId) {
        const match = lastPatient.patientId.match(/^PT-(\d+)$/);
        if (match) currentMax = parseInt(match[1], 10);
      }
      await Counter.findOneAndUpdate(
        { _id: 'patientId' },
        { $setOnInsert: { seq: currentMax } },
        { upsert: true }
      );
    }

    const updatedCounter = await Counter.findOneAndUpdate(
      { _id: 'patientId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.patientId = `PT-${String(updatedCounter.seq).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Patient', patientSchema);
