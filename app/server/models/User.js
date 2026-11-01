const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8  // M-2: raised from 6 to 8
  },
  role: {
    type: String,
    enum: ['patient', 'doctor', 'admin'],
    default: 'patient'
  },
  specialization: {
    type: String,
    default: '',
    maxlength: 100
  },
  phone: {
    type: String,
    default: '',
    maxlength: 20
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// ── Password complexity validator (M-2) ───────────────────────────────────────
// Enforced at the route level before hashing; this runs as a safeguard.
userSchema.path('password').validate(function (value) {
  // Only validate the plain-text password (before hashing).
  // After hashing it starts with '$2', so skip validation.
  if (value && value.startsWith('$2')) return true;
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 digit
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
}, 'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one number.');

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
