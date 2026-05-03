const express = require('express');
const User = require('../models/User');
const Patient = require('../models/Patient');
const HealthData = require('../models/HealthData');
const Alert = require('../models/Alert');
const AuditLog = require('../models/AuditLog');
const Report = require('../models/Report');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

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

// POST /api/admin/users - Create a new user (doctor/admin accounts)
router.post('/users', auth, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, role, specialization, phone } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }
    const validRoles = ['patient', 'doctor', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const user = new User({ name, email, password, role, specialization: specialization || '', phone: phone || '' });
    await user.save();

    await AuditLog.create({
      action: `New ${role} account created: ${name} (${email})`,
      category: 'admin',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      severity: 'info'
    });

    res.status(201).json({ message: `${role} account created successfully`, user: { ...user.toJSON(), password: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/users/:id - Update user (role, active status)
router.put('/users/:id', auth, authorize('admin'), async (req, res) => {
  try {
    // Prevent admin from deactivating/demoting themselves
    if (req.params.id === req.user._id.toString()) {
      const { role, isActive } = req.body;
      if (isActive === false) return res.status(400).json({ error: 'You cannot deactivate your own account' });
      if (role && role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }

    const { role, isActive } = req.body;
    const update = {};
    if (role) update.role = role;
    if (isActive !== undefined) update.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await AuditLog.create({
      action: `User ${user.name} updated: ${JSON.stringify(update)}`,
      category: 'admin',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      severity: 'warning'
    });

    res.json({ message: 'User updated', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// GET /api/admin/audit-logs - System audit logs
router.get('/audit-logs', auth, authorize('admin'), async (req, res) => {
  try {
    const { limit = 50, category } = req.query;
    let query = {};
    if (category) query.category = category;
    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/devices - List unique device IDs from health data
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
      { $sort: { lastActive: -1 } }
    ]);
    res.json({ devices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
