// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/deviceFingerprint.js
// ARVIND PARTY - DEVICE FINGERPRINTING + ANTI-BAN MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

const BannedDevice = require('../models/BannedDevice');

/**
 * @desc Extract device fingerprint from request headers
 * @param {Object} req - Express request object
 * @returns {String} Device fingerprint
 */
const extractDeviceFingerprint = (req) => {
  return (
    req.headers['x-device-fingerprint'] ||
    req.headers['X-Device-Fingerprint'] ||
    req.body?.deviceFingerprint ||
    req.query?.deviceFingerprint ||
    null
  );
};

/**
 * @desc Extract device info from request headers
 * @param {Object} req - Express request object
 * @returns {Object} Device information
 */
const extractDeviceInfo = (req) => {
  return {
    userAgent: req.headers['user-agent'] || req.headers['User-Agent'],
    platform: req.headers['x-platform'] || req.headers['X-Platform'],
    deviceId: req.headers['x-device-id'] || req.headers['X-Device-Id'],
    appVersion: req.headers['x-app-version'] || req.headers['X-App-Version'],
  };
};

/**
 * @desc Capture full device fingerprint from request (used in controllers)
 * @param {Object} req
 * @returns {Object} deviceFingerprint object
 */
const captureDeviceFingerprint = (req) => {
  const deviceId = req.headers['x-device-id'] || req.body?.deviceId || null;
  const ipAddress = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  const platform = req.headers['x-platform'] || req.body?.platform || null;

  return {
    deviceId,
    ipAddress: ipAddress ? ipAddress.split(',')[0].trim() : null,
    userAgent,
    platform,
    capturedAt: new Date().toISOString(),
  };
};

/**
 * @desc Middleware to check if device is hard-banned
 * Checks deviceId from headers/body against BannedDevice collection
 */
const checkBannedDevice = async (req, res, next) => {
  try {
    const deviceId = req.headers['x-device-id'] || req.body?.deviceId || req.query?.deviceId || null;

    if (!deviceId) {
      const publicRoutes = ['/auth/login', '/auth/register', '/auth/send-otp', '/auth/otp-verify', '/auth/firebase-verify', '/auth/apple-verify'];
      const currentPath = req.path;
      if (publicRoutes.some(route => currentPath.startsWith(route))) {
        return next();
      }
    }

    if (deviceId) {
      const bannedDevice = await BannedDevice.findOne({ deviceId: deviceId.trim() });
      if (bannedDevice) {
        return res.status(403).json({
          success: false,
          code: 'DEVICE_BANNED',
          message: 'This device has been permanently banned from the platform.',
          bannedReason: bannedDevice.reason,
          bannedAt: bannedDevice.bannedAt,
        });
      }
    }

    next();
  } catch (error) {
    console.error('[checkBannedDevice] Error:', error);
    next();
  }
};

/**
 * @desc Middleware to validate device fingerprint
 */
const validateDeviceFingerprint = async (req, res, next) => {
  try {
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/verify-otp', '/'];
    const currentPath = req.path;

    if (publicRoutes.some(route => currentPath.startsWith(route))) {
      return next();
    }

    const fingerprint = extractDeviceFingerprint(req);

    if (process.env.NODE_ENV === 'development' && !fingerprint) {
      return next();
    }

    if (!fingerprint && process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Device fingerprint required',
        code: 'DEVICE_FINGERPRINT_MISSING',
      });
    }

    if (fingerprint) {
      const User = require('../models/User');
      const userId = req.user?.id || req.userId;

      if (userId) {
        const user = await User.findById(userId).select('registeredDevices');

        if (user?.registeredDevices?.length > 0) {
          const isRegistered = user.registeredDevices.some(
            device => device.fingerprint === fingerprint
          );

          if (!isRegistered) {
            console.log(`[DeviceFingerprint] New device detected for user ${userId}: ${fingerprint}`);
            req.newDeviceDetected = true;
            req.deviceFingerprint = fingerprint;
          }
        } else {
          req.newDeviceDetected = true;
          req.deviceFingerprint = fingerprint;
        }
      }

      req.deviceFingerprint = fingerprint;
    }

    next();
  } catch (error) {
    console.error('[DeviceFingerprint] Middleware error:', error);
    next();
  }
};

/**
 * @desc Register device fingerprint for user
 */
const registerDeviceFingerprint = async (userId, fingerprint, deviceInfo = {}) => {
  try {
    if (!fingerprint) return false;

    const User = require('../models/User');

    const user = await User.findById(userId);
    if (!user) return false;

    if (!user.registeredDevices) {
      user.registeredDevices = [];
    }

    const existingIndex = user.registeredDevices.findIndex(
      device => device.fingerprint === fingerprint
    );

    if (existingIndex >= 0) {
      user.registeredDevices[existingIndex].lastUsed = new Date();
      user.registeredDevices[existingIndex].deviceInfo = {
        ...user.registeredDevices[existingIndex].deviceInfo,
        ...deviceInfo,
      };
    } else {
      user.registeredDevices.push({
        fingerprint,
        deviceInfo,
        registeredAt: new Date(),
        lastUsed: new Date(),
        isTrusted: false,
      });
    }

    if (user.registeredDevices.length > 10) {
      user.registeredDevices = user.registeredDevices.slice(-10);
    }

    await user.save();
    console.log(`[DeviceFingerprint] Device registered for user ${userId}: ${fingerprint}`);
    return true;
  } catch (error) {
    console.error('[DeviceFingerprint] Registration error:', error);
    return false;
  }
};

/**
 * @desc Remove device fingerprint for user
 */
const removeDeviceFingerprint = async (userId, fingerprint) => {
  try {
    const User = require('../models/User');

    const user = await User.findById(userId);
    if (!user) return false;

    if (user.registeredDevices) {
      user.registeredDevices = user.registeredDevices.filter(
        device => device.fingerprint !== fingerprint
      );
      await user.save();
      console.log(`[DeviceFingerprint] Device removed for user ${userId}: ${fingerprint}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[DeviceFingerprint] Removal error:', error);
    return false;
  }
};

module.exports = {
  validateDeviceFingerprint,
  extractDeviceFingerprint,
  extractDeviceInfo,
  captureDeviceFingerprint,
  checkBannedDevice,
  registerDeviceFingerprint,
  removeDeviceFingerprint,
};