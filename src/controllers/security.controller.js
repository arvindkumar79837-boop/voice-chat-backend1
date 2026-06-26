// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/security.controller.js
// ARVIND PARTY — Security Dashboard Controller for Owner Web Panel
// Endpoints: fraud alerts, banned devices, blocked IPs, audit logs
// ═══════════════════════════════════════════════════════════════════════════

const AuditLog = require('../models/AuditLog');
const FraudAlert = require('../models/FraudAlert');
const BannedDevice = require('../models/BannedDevice');
const BlockedIp = require('../models/BlockedIp');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD SUMMARY (requires owner or admin role)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const [fraudOpen, fraudCritical, bannedCount, blockedCount, recentLogsCount, flaggedUsers] = await Promise.all([
      FraudAlert.countDocuments({ status: 'OPEN' }),
      FraudAlert.countDocuments({ severity: 'CRITICAL', status: 'OPEN' }),
      BannedDevice.countDocuments({}),
      BlockedIp.countDocuments({}),
      AuditLog.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      User.countDocuments({ $or: [{ isBanned: true }, { isBlocked: true }, { suspiciousActivityCount: { $gt: 5 } }] }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        openFraudAlerts: fraudOpen,
        criticalFraudAlerts: fraudCritical,
        bannedDevices: bannedCount,
        blockedIps: blockedCount,
        auditLogsLast24h: recentLogsCount,
        flaggedUsers,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Security Dashboard Error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FRAUD ALERTS (paginated)
// ─────────────────────────────────────────────────────────────────────────────
exports.getFraudAlerts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const severity = req.query.severity;
    const status = req.query.status;

    const filter = {};
    if (severity) filter.severity = severity;
    if (status) filter.status = status;

    const [alerts, total] = await Promise.all([
      FraudAlert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FraudAlert.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: alerts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get Fraud Alerts Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fraud alerts.' });
  }
};

exports.updateFraudAlert = async (req, res) => {
  try {
    const alert = await FraudAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Audit alert not found.' });
    }

    const allowed = ['status', 'severity', 'resolutionNote', 'accountHeld', 'heldUntil', 'financeManagerNotified'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    Object.assign(alert, updates);
    await alert.save();

    await AuditLog.create({
      action: 'SETTINGS_UPDATED',
      executorId: req.user.id || req.user._id,
      executorUid: req.user.uid,
      executorRole: req.user.role,
      reason: `Fraud alert ${req.params.id} updated`,
      metadata: { alertId: req.params.id, updates }
    });

    res.status(200).json({ success: true, data: alert });
  } catch (error) {
    console.error('Update Fraud Alert Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update alert.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BANNED DEVICES
// ─────────────────────────────────────────────────────────────────────────────
exports.getBannedDevices = async (req, res) => {
  try {
    const devices = await BannedDevice.find({}).sort({ bannedAt: -1 }).lean();
    res.status(200).json({ success: true, data: devices });
  } catch (error) {
    console.error('Get Banned Devices Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch banned devices.' });
  }
};

exports.banDevice = async (req, res) => {
  try {
    const { deviceId, reason } = req.body;
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'deviceId is required.' });
    }

    const existing = await BannedDevice.findOne({ deviceId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Device already banned.' });
    }

    const device = await BannedDevice.create({
      deviceId,
      reason: reason || 'Violation of platform policies.',
      bannedBy: req.user._id || req.user.id,
    });

    await AuditLog.create({
      action: 'DEVICE_FLAGGED',
      executorId: req.user._id || req.user.id,
      executorUid: req.user.uid,
      executorRole: req.user.role,
      reason: `Banned device ${deviceId}`,
      deviceId,
      metadata: { reason }
    });

    res.status(201).json({ success: true, data: device });
  } catch (error) {
    console.error('Ban Device Error:', error);
    res.status(500).json({ success: false, message: 'Failed to ban device.' });
  }
};

exports.unbanDevice = async (req, res) => {
  try {
    await BannedDevice.findByIdAndDelete(req.params.id);
    await AuditLog.create({
      action: 'SETTINGS_UPDATED',
      executorId: req.user._id || req.user.id,
      executorUid: req.user.uid,
      executorRole: req.user.role,
      reason: `Unbanned device ${req.params.id}`,
      metadata: { deviceId: req.params.id }
    });
    res.status(200).json({ success: true, message: 'Device unbanned.' });
  } catch (error) {
    console.error('Unban Device Error:', error);
    res.status(500).json({ success: false, message: 'Failed to unban device.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKED IPs
// ─────────────────────────────────────────────────────────────────────────────
exports.getBlockedIps = async (req, res) => {
  try {
    const ips = await BlockedIp.find({}).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: ips });
  } catch (error) {
    console.error('Get Blocked IPs Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blocked IPs.' });
  }
};

exports.blockIp = async (req, res) => {
  try {
    const { ipAddress, reason, isPermanent } = req.body;
    if (!ipAddress) {
      return res.status(400).json({ success: false, message: 'ipAddress is required.' });
    }

    const existing = await BlockedIp.findOne({ ipAddress });
    if (existing) {
      return res.status(409).json({ success: false, message: 'IP already blocked.' });
    }

    const ip = await BlockedIp.create({
      ipAddress,
      reason: reason || 'Security violation',
      blockedBy: req.user._id || req.user.id,
      isPermanent: !!isPermanent,
      isVpnBlock: false,
    });

    await AuditLog.create({
      action: 'RATE_LIMIT_EXCEEDED',
      executorId: req.user._id || req.user.id,
      executorUid: req.user.uid,
      executorRole: req.user.role,
      reason: `Blocked IP ${ipAddress}`,
      ipAddress,
      metadata: { reason, isPermanent: !!isPermanent }
    });

    res.status(201).json({ success: true, data: ip });
  } catch (error) {
    console.error('Block IP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to block IP.' });
  }
};

exports.unblockIp = async (req, res) => {
  try {
    await BlockedIp.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'IP unblocked.' });
  } catch (error) {
    console.error('Unblock IP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to unblock IP.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS (append-only)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const action = req.query.action;

    const filter = {};
    if (action) filter.action = action;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get Audit Logs Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LIVE THREAT MONITOR: active sessions + suspicious users
// ─────────────────────────────────────────────────────────────────────────────
exports.getLiveThreats = async (req, res) => {
  try {
    const suspiciousUsers = await User.find({
      $or: [{ isBanned: true }, { isBlocked: true }, { suspiciousActivityCount: { $gt: 3 } }],
    }).sort({ suspiciousActivityCount: -1 }).limit(100).lean();

    // Recent critical alerts not yet resolved
    const criticalAlerts = await FraudAlert.find({
      severity: 'CRITICAL',
      status: { $in: ['OPEN', 'INVESTIGATING'] },
    }).sort({ createdAt: -1 }).limit(50).lean();

    res.status(200).json({
      success: true,
      data: {
        suspiciousUsers,
        criticalAlerts,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get Live Threats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch live threats.' });
  }
};