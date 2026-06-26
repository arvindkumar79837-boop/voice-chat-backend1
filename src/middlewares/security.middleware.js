// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/security.middleware.js
// ARVIND PARTY - NETWORK & HARDWARE LOCKDOWN MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

const BannedDevice = require('../models/BannedDevice');
const { checkIpInfo } = require('../services/ip.service');

/**
 * Middleware to perform security checks for device ID and IP address.
 * This should be applied to all sensitive routes.
 */
const networkLockdown = async (req, res, next) => {
  try {
    // 1. Device Lock (Hardware Ban) Check
    // The device ID should be sent by the mobile app in this header.
    const deviceId = req.headers['x-device-id'];

    if (deviceId) {
      const isBanned = await BannedDevice.findOne({ deviceId });
      if (isBanned) {
        console.warn(`[Security] Blocked request from banned device ID: ${deviceId}`);
        return res.status(403).json({
          success: false,
          code: 'DEVICE_BANNED',
          message: 'This device has been permanently blocked from accessing the service due to severe policy violations.',
        });
      }
    }

    // 2. IP Restriction & VPN Detection
    // Use 'req.ip' which Express provides. Ensure 'trust proxy' is set in app.js if behind a load balancer.
    const ipAddress = req.ip;

    // We can skip VPN checks for certain non-critical or public endpoints if needed.
    // For now, we check all requests that pass through this middleware.
    const ipInfo = await checkIpInfo(ipAddress);
    req.ipInfo = ipInfo; // Attach IP info to the request for logging or other uses.

    if (ipInfo.isVpn) {
      console.warn(`[Security] Blocked VPN request from IP: ${ipAddress} (${ipInfo.country})`);
      return res.status(403).json({
        success: false,
        code: 'VPN_DETECTED',
        message: 'Access via VPNs, proxies, or anonymous networks is not permitted. Please disable your VPN and try again.',
      });
    }

    // If all checks pass, proceed to the next middleware or route handler.
    next();

  } catch (error) {
    console.error('[Security Middleware] An unexpected error occurred:', error);
    // Fail-safe: In case of an error in the middleware, allow the request to prevent service disruption.
    // However, this should be monitored closely.
    next();
  }
};

module.exports = {
  networkLockdown,
};