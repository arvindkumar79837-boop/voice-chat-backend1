const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authSecure.controller');
const { refreshTokenMiddleware } = require('../middlewares/refreshToken.middleware');
const authMiddleware = require('../middlewares/auth.middleware');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 10,
  message: { success: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Firebase login
router.post('/firebase-login', authLimiter, controller.firebaseLogin);

// Refresh token (uses custom refresh middleware, not standard JWT)
router.post('/refresh-token', refreshTokenMiddleware, controller.refreshToken);

// Secure logout — blacklists access token + revokes refresh token
router.post('/logout', authMiddleware, controller.logout);

// Revoke all active sessions for current user
router.post('/revoke-all-sessions', authMiddleware, controller.revokeAllSessions);

// Admin: revoke all sessions for any user
router.post('/admin/revoke-user-sessions', authMiddleware, controller.adminRevokeUserSessions);

module.exports = router;