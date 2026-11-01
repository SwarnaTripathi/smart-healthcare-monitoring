const express = require('express');
const Alert = require('../models/Alert');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper: get the patientId string for a patient-role user
async function _getPatientIdForUser(user) {
  const patient = await Patient.findOne({ user: user._id });
  if (patient) return patient.patientId;
  const byName = await Patient.findOne({ name: { $regex: new RegExp(`^${user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  if (byName) {
    byName.user = user._id;
    await byName.save();
    return byName.patientId;
  }
  return null;
}

// Helper: get all patientIds assigned to a doctor
async function _getDoctorPatientIds(userId) {
  const patients = await Patient.find({ assignedDoctor: userId }).select('patientId');
  return patients.map(p => p.patientId);
}

// Helper: build role-based alert filter
async function _buildAlertFilter(user) {
  if (user.role === 'patient') {
    const pid = await _getPatientIdForUser(user);
    return pid ? { patientId: pid } : null;
  }
  if (user.role === 'doctor') {
    const pids = await _getDoctorPatientIds(user._id);
    return { patientId: { $in: pids } };
  }
  // admin sees all
  return {};
}

// GET /api/alerts/stats/summary
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const filter = await _buildAlertFilter(req.user);
    if (!filter) return res.json({ stats: { total: 0, unacknowledged: 0, critical: 0, warning: 0, recent: 0 } });

    const total          = await Alert.countDocuments(filter);
    const unacknowledged = await Alert.countDocuments({ ...filter, acknowledged: false });
    const critical       = await Alert.countDocuments({ ...filter, type: 'critical', acknowledged: false });
    const warning        = await Alert.countDocuments({ ...filter, type: 'warning',  acknowledged: false });
    const last24h        = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent         = await Alert.countDocuments({ ...filter, createdAt: { $gte: last24h } });

    res.json({ stats: { total, unacknowledged, critical, warning, recent } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/alerts/acknowledge-all
router.put('/acknowledge-all', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const filter = await _buildAlertFilter(req.user);
    if (!filter) return res.json({ message: 'No alerts to acknowledge' });
    await Alert.updateMany(
      { ...filter, acknowledged: false },
      { acknowledged: true, acknowledgedBy: req.user._id, acknowledgedAt: new Date() }
    );

    // M-5: Audit bulk acknowledge
    await AuditLog.create({
      action: 'All visible alerts acknowledged (bulk)',
      category: 'alert',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'info'
    });

    res.json({ message: 'All alerts acknowledged' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 200, acknowledged, type, patientId, status } = req.query;
    const roleFilter = await _buildAlertFilter(req.user);
    if (!roleFilter) return res.json({ alerts: [], unacknowledgedCount: 0 });

    let query = { ...roleFilter };
    if (status && ['open', 'acknowledged', 'resolved'].includes(status)) {
      query.status = status;
    } else if (acknowledged !== undefined) {
      query.acknowledged = acknowledged === 'true';
    }
    if (type) query.type = type;

    // G2: only allow narrowing within the role-scoped set, never expanding it.
    if (patientId) {
      const allowedPids = roleFilter.patientId?.$in ?? (roleFilter.patientId ? [roleFilter.patientId] : null);
      if (allowedPids === null) {
        query.patientId = patientId;
      } else if (allowedPids.includes(patientId)) {
        query.patientId = patientId;
      }
    }

    // L-6: cap limit at 500
    const safeLimit = Math.min(parseInt(limit) || 200, 500);

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .populate('acknowledgedBy resolvedBy', 'name role');
    const unacknowledgedCount = await Alert.countDocuments({ ...roleFilter, acknowledged: false });
    res.json({ alerts, unacknowledgedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve alerts.' });
  }
});

// GET /api/alerts/my-patient-ids
router.get('/my-patient-ids', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin')  return res.json({ patientIds: null });
    if (req.user.role === 'doctor') {
      const pids = await _getDoctorPatientIds(req.user._id);
      return res.json({ patientIds: pids });
    }
    const pid = await _getPatientIdForUser(req.user);
    return res.json({ patientIds: pid ? [pid] : [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/alerts/:id/acknowledge  (G3: ownership check added, lifecycle: acknowledged)
router.put('/:id/acknowledge', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const alertDoc = await Alert.findById(req.params.id);
    if (!alertDoc) return res.status(404).json({ error: 'Alert not found' });

    // G3: verify the requesting doctor is assigned to this patient
    if (req.user.role === 'doctor') {
      const pids = await _getDoctorPatientIds(req.user._id);
      if (!pids.includes(alertDoc.patientId)) {
        return res.status(403).json({ error: 'Access denied. This patient is not assigned to you.' });
      }
    }

    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        status: 'acknowledged',
        acknowledged: true,
        acknowledgedBy: req.user._id,
        acknowledgedAt: new Date()
      },
      { new: true }
    ).populate('acknowledgedBy resolvedBy', 'name role');

    // M-5: Audit alert acknowledgment
    await AuditLog.create({
      action: `Alert acknowledged: ${alert.type.toUpperCase()} — ${alert.metric} for patient ${alert.patientId}`,
      category: 'alert',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'info'
    });

    const io = req.app.get('io');
    if (io) io.to(`patient:${alertDoc.patientId}`).emit('alert-acknowledged', alert);
    if (io) io.to('admin').emit('alert-acknowledged', alert);
    res.json({ message: 'Alert acknowledged', alert });
  } catch (error) {
    res.status(500).json({ error: 'Failed to acknowledge alert.' });
  }
});

// PUT /api/alerts/:id/resolve  (Requirement 7: Alert lifecycle - resolved state)
router.put('/:id/resolve', auth, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const alertDoc = await Alert.findById(req.params.id);
    if (!alertDoc) return res.status(404).json({ error: 'Alert not found' });

    // Doctor assignment authorization
    if (req.user.role === 'doctor') {
      const pids = await _getDoctorPatientIds(req.user._id);
      if (!pids.includes(alertDoc.patientId)) {
        return res.status(403).json({ error: 'Access denied. This patient is not assigned to you.' });
      }
    }

    const { resolutionReason } = req.body;
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        status: 'resolved',
        resolved: true,
        resolvedBy: req.user._id,
        resolvedAt: new Date(),
        resolutionReason: resolutionReason || 'Clinician marked alert resolved'
      },
      { new: true }
    ).populate('acknowledgedBy resolvedBy', 'name role');

    await AuditLog.create({
      action: `Alert resolved: ${alert.type.toUpperCase()} — ${alert.metric} for patient ${alert.patientId}`,
      category: 'alert',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'info'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`patient:${alertDoc.patientId}`).emit('alert-resolved', alert);
      io.to('admin').emit('alert-resolved', alert);
    }
    res.json({ message: 'Alert resolved successfully', alert });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve alert.' });
  }
});

// DELETE /api/alerts/:id  (G11: audit log added)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    // G11: Audit alert deletion
    await AuditLog.create({
      action: `Alert deleted: ${alert.type.toUpperCase()} — ${alert.metric} for patient ${alert.patientId}`,
      category: 'alert',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip,
      severity: 'warning'
    });

    res.json({ message: 'Alert deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete alert.' });
  }
});

module.exports = router;
