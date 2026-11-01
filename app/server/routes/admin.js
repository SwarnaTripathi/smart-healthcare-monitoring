const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Patient = require('../models/Patient');
const HealthData = require('../models/HealthData');
const Alert = require('../models/Alert');
const AuditLog = require('../models/AuditLog');
const Report = require('../models/Report');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Validation rules (G5/G9) ───────────────────────────────────────────────────
const adminUserCreateValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('role').isIn(['patient', 'doctor', 'admin']).withMessage('Role must be patient, doctor, or admin'),
];

// GET /api/admin/stats - System-wide statistics
router.get('/stats', auth, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const doctors = await User.countDocuments({ role: 'doctor' });
    const patients = await User.countDocuments({ role: 'patient' });
    const admins = await User.countDocuments({ role: 'admin' });
    const totalPatients = await Patient.countDocuments();
    const activePatients = await Patient.countDocuments({ status: 'active' });
    const criticalPatients = await Patient.countDocuments({ status: 'critical' });
    const totalReadings = await HealthData.countDocuments();
    const totalAlerts = await Alert.countDocuments();
    const pendingAlerts = await Alert.countDocuments({ acknowledged: false });
    const totalReports = await Report.countDocuments();

    res.json({
      stats: {
        totalUsers, doctors, patients, admins,
        totalPatients, activePatients, criticalPatients,
        totalReadings, totalAlerts, pendingAlerts, totalReports
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/users - All users with management
router.get('/users', auth, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/users - Create a new user (doctor/admin accounts)  (G5/G9: validated)
router.post('/users', auth, authorize('admin'), adminUserCreateValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const { name, email, password, role, specialization, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const user = new User({ name, email, password, role, specialization: specialization || '', phone: phone || '' });
    await user.save();

    await AuditLog.create({
      action: `New ${role} account created: ${name}`,
      category: 'admin',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'info'
    });

    res.status(201).json({ message: `${role} account created successfully`, user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user account.' });
  }
});

// PUT /api/admin/users/:id - Update user (role, active status)  (G6/G12: sanitised errors + password-change audit)
router.put('/users/:id', auth, authorize('admin'), async (req, res) => {
  try {
    // Prevent admin from deactivating/demoting themselves
    if (req.params.id === req.user._id.toString()) {
      const { role, isActive } = req.body;
      if (isActive === false) return res.status(400).json({ error: 'You cannot deactivate your own account' });
      if (role && role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }

    const { role, isActive, password } = req.body;
    const update = {};
    if (role) {
      if (!['patient', 'doctor', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role value.' });
      }
      update.role = role;
    }
    if (isActive !== undefined) update.isActive = isActive;

    // G12: If a password reset is being performed, hash and audit it separately
    if (password) {
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters and contain uppercase, lowercase, and a number.' });
      }
      // Let the User model's pre-save hook hash it
      const targetUser = await User.findById(req.params.id);
      if (!targetUser) return res.status(404).json({ error: 'User not found' });
      targetUser.password = password;
      await targetUser.save();

      await AuditLog.create({
        action: `Password reset for user: ${targetUser.name} (${targetUser.role})`,
        category: 'admin',
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        ipAddress: req.ip,
        severity: 'warning'
      });
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (Object.keys(update).length > 0) {
      await AuditLog.create({
        action: `User ${user.name} updated: ${JSON.stringify(update)}`,
        category: 'admin',
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        ipAddress: req.ip,
        severity: 'warning'
      });
    }

    res.json({ message: 'User updated', user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await AuditLog.create({
      action: `User ${user.name} (${user.email}) deleted`,
      category: 'admin',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      severity: 'critical'
    });

    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/audit-logs - System audit logs (validated, paginated, capped)
router.get('/audit-logs', auth, authorize('admin'), async (req, res) => {
  try {
    const { category, page = 1, limit = 50 } = req.query;
    let query = {};

    // Validate category strictly against whitelist to prevent NoSQL operator injection
    const allowedCategories = ['auth', 'patient', 'health_data', 'alert', 'report', 'admin', 'system'];
    if (category && typeof category === 'string' && allowedCategories.includes(category)) {
      query.category = category;
    }

    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);
    const safePage  = Math.max(1, parseInt(page, 10) || 1);
    const skip      = (safePage - 1) * safeLimit;

    const total = await AuditLog.countDocuments(query);
    const logs  = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit);

    res.json({
      logs,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/devices - List unique device IDs from health data (bounded aggregation)
router.get('/devices', auth, authorize('admin'), async (req, res) => {
  try {
    const devices = await HealthData.aggregate([
      { $group: {
        _id: '$deviceId',
        patientId: { $first: '$patientId' },
        lastActive: { $max: '$timestamp' },
        totalReadings: { $sum: 1 },
        avgHR: { $avg: '$heartRate' },
        avgSpO2: { $avg: '$spO2' },
        avgTemp: { $avg: '$temperature' }
      }},
      { $sort: { lastActive: -1 } },
      { $limit: 100 }
    ]);
    res.json({ devices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
