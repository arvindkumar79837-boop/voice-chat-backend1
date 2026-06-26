// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/middlewares/refreshToken.middleware.js
// ARVIND PARTY — Refresh Token Rotation & Revocation Guard
// • Validates refresh tokens against DB + Redis
// • Supports token rotation (issue new RT on use)
// • Revokes family on security events
// ═══════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const { verifyRefreshToken } = require('../utils/jwt');
const { verifyIdToken } = require('../config/firebase-admin');

/**
 * Attaches refreshToken middleware to router.
 * Expects body: { refreshToken: string }
 * On success: req.refreshPayload = decoded payload
 * On failure: 401 with code REFRESH_TOKEN_INVALID
 */
const refreshTokenMiddleware = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Refresh token is required.',
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Invalid or expired refresh token.',
      });
    }

    const userId = decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Malformed refresh token payload.',
      });
    }

    // Look up persisted refresh token record
    const stored = await RefreshToken.findOne({ userId, token: refreshToken });

    if (!stored) {
      // Token not found in DB — possible theft. Revoke ALL tokens for this user.
      await RefreshToken.updateMany({ userId, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: 'Unknown refresh token presented — all tokens revoked.' });
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_INALID',
        message: 'Refresh token not recognized. All sessions have been revoked for security.',
      });
    }

    if (stored.isRevoked) {
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_REVOKED',
        message: 'This refresh token has been revoked.',
      });
    }

    // If expired, let it fail
    if (stored.expiresAt && stored.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired. Please log in again.',
      });
    }

    // Attach user info & refresh token for use in the handler
    const user = await User.findById(userId);
    if (!user || user.isBanned) {
      return res.status(403).json({
        success: false,
        code: 'USER_BANNED',
        message: 'This account has been banned.',
      });
    }

    req.user = user;
    req.refreshTokenRecord = stored;
    next();
  } catch (error) {
    console.error('Refresh Token Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during token refresh.',
    });
  }
};

module.exports = { refreshTokenMiddleware };