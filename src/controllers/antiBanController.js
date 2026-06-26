// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/antiBanController.js
// ARVIND PARTY - ANTI-BAN & DEVICE MANAGEMENT (Owner Panel)
// ═══════════════════════════════════════════════════════════════════════════

const BannedDevice = require('../models/BannedDevice');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// ═══════════════════════════════════════════════════════════════════════════
// BAN DEVICE PERMANENTLY
// POST /api/admin/anti-ban/ban-device
// Body: { deviceId, userId, reason }
// ═══════════════════════════════════════════════════════════════════════════

exports.banDevice = async (req, res, next) => {
  try {
    const { deviceId, userId, reason } = req.body;
    const bannedBy = req.user.userId;
    const adminRole = req.user.role;

    if (!['admin', 'owner'].includes(adminRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and owners can ban devices',
        code: 'FORBIDDEN',
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
    }

    const existingBan = await BannedDevice.findOne({ deviceId });
    if (existingBan) {
      return res.status(409).json({
        success: false,
        message: 'This device is already banned',
        code: 'DEVICE_ALREADY_BANNED',
        bannedAt: existingBan.bannedAt,
        bannedReason: existingBan.reason,
      });
    }

    const bannedDevice = await BannedDevice.create({
      deviceId: deviceId.trim(),
      reason: reason || 'Repeated violation of platform policies.',
      bannedBy: bannedBy,
      bannedAt: new Date(),
    });

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        isBanned: true,
        isActive: false,
        banReason: reason || 'Device banned for policy violation',
        bannedAt: new Date(),
        bannedBy: bannedBy,
      });
    }

    await AuditLog.create({
      action: 'DEVICE_BANNED',
      performedBy: bannedBy,
      targetUser: userId || null,
      targetDevice: deviceId,
      reason: reason || 'Policy violation',
      metadata: {
        deviceId: deviceId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(200).json({
      success: true,
      message: 'Device has been permanently banned.',
      data: {
        deviceId: bannedDevice.deviceId,
        reason: bannedDevice.reason,
        bannedAt: bannedDevice.bannedAt,
      },
    });
  } catch (error) {
    console.error('❌ Ban Device Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UNBAN DEVICE
// POST /api/admin/anti-ban/unban-device
// Body: { deviceId }
// ═══════════════════════════════════════════════════════════════════════════

exports.unbanDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user.userId;
    const adminRole = req.user.role;

    if (!['admin', 'owner'].includes(adminRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and owners can unban devices',
        code: 'FORBIDDEN',
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
    }

    const bannedDevice = await BannedDevice.findOneAndDelete({ deviceId: deviceId.trim() });
    if (!bannedDevice) {
      return res.status(404).json({
        success: false,
        message: 'Device not found in banned list',
      });
    }

    await AuditLog.create({
      action: 'DEVICE_UNBANNED',
      performedBy: userId,
      targetDevice: deviceId,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(200).json({
      success: true,
      message: 'Device has been unbanned successfully.',
    });
  } catch (error) {
    console.error('❌ Unban Device Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// LIST ALL BANNED DEVICES
// GET /api/admin/anti-ban/banned-devices
// Query: { page, limit, search }
// ═══════════════════════════════════════════════════════════════════════════

exports.listBannedDevices = async (req, res, next) => {
  try {
    const adminRole = req.user.role;
    if (!['admin', 'owner'].includes(adminRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'FORBIDDEN',
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { deviceId: { $regex: search, $options: 'i' } },
          { reason: { $regex: search, $options: 'i' } },
        ],
      };
    }

    const [bannedDevices, total] = await Promise.all([
      BannedDevice.find(query)
        .populate('bannedBy', 'name username email')
        .sort({ bannedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BannedDevice.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        bannedDevices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('❌ List Banned Devices Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK IF DEVICE IS BANNED (for app startup validation)
// POST /api/security/check-device
// Body: { deviceId }
// ═══════════════════════════════════════════════════════════════════════════

exports.checkDeviceStatus = async (req, res, next) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
    }

    const bannedDevice = await BannedDevice.findOne({ deviceId: deviceId.trim() });

    if (bannedDevice) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        code: 'DEVICE_BANNED',
        message: 'This device has been banned from the platform.',
        bannedReason: bannedDevice.reason,
        bannedAt: bannedDevice.bannedAt,
      });
    }

    res.status(200).json({
      success: true,
      isBanned: false,
      message: 'Device is not banned',
    });
  } catch (error) {
    console.error('❌ Check Device Status Error:', error);
    next(error);
  }
};