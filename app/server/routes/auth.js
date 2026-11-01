const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ── Validation helpers ────────────────────────────────────────────────────────
const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const { name, email, password, role, specialization, phone } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Self-registration is restricted to patient role only
    if (role && role !== 'patient') {
      return res.status(400).json({ error: 'Only patient accounts can be self-registered. Contact admin for doctor/admin accounts.' });
    }

    const user = new User({
      name,
      email,
      password,
      role: role || 'patient',
      specialization: specialization || '',
      phone: phone || ''
    });

    await user.save();

    // M-5: Audit successful registration
    await AuditLog.create({
      action: `New patient registered: ${name} (${email})`,
      category: 'auth',
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      ipAddress: req.ip,
      severity: 'info'
    });

    // M-4: Reduced TTL from 24h to 2h
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      // M-5: Log failed login attempt
      await AuditLog.create({
        action: `Failed login attempt for email: ${email}`,
        category: 'auth',
        ipAddress: req.ip,
        severity: 'warning'
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      await AuditLog.create({
        action: `Login attempt on deactivated account: ${email}`,
        category: 'auth',
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        ipAddress: req.ip,
        severity: 'warning'
      });
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await AuditLog.create({
        action: `Failed login attempt (wrong password) for: ${email}`,
        category: 'auth',
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        ipAddress: req.ip,
        severity: 'warning'
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // M-4: Reduced TTL from 24h to 2h
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // M-5: Audit successful login
    await AuditLog.create({
      action: `User logged in: ${user.name} (${user.role})`,
      category: 'auth',
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      ipAddress: req.ip,
      severity: 'info'
    });

    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// L-3: Client calls this on mount to revalidate the session
router.get('/me', auth, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// M-4/M-5: Server-side logout audit. Token invalidation requires a denylist;
// for now we log the event and the client drops the token. A Redis denylist
// can be added here when infrastructure allows.
router.post('/logout', auth, async (req, res) => {
  try {
    await AuditLog.create({
      action: `User logged out: ${req.user.name} (${req.user.role})`,
      category: 'auth',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'info'
    });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/auth/users — Admin: get all users ────────────────────────────────
router.get('/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
