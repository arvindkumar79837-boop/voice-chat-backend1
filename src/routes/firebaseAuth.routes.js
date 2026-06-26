// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/firebaseAuth.routes.js
// ARVIND PARTY - FIREBASE AUTH ROUTES (Multi-Platform Login)
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const firebaseAuthController = require('../controllers/firebaseAuth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 10,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// PUBLIC ROUTES - Firebase ID Token Verification

router.post('/firebase-verify', authLimiter, (req, res, next) => {
  try {
    const { idToken, deviceId, deviceInfo, platform } = req.body;

    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required',
        code: 'MISSING_TOKEN',
      });
    }

    if (!platform || !['android', 'ios', 'web', 'windows'].includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Valid platform is required (android, ios, web, windows)',
        code: 'INVALID_PLATFORM',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}, firebaseAuthController.verifyFirebaseToken);

router.post('/apple-verify', authLimiter, (req, res, next) => {
  try {
    const { identityToken, deviceId, deviceInfo, platform } = req.body;

    if (!identityToken || typeof identityToken !== 'string' || identityToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Apple identity token is required',
        code: 'MISSING_TOKEN',
      });
    }

    if (!platform || !['ios', 'macos', 'windows'].includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Valid platform is required (ios, macos, windows)',
        code: 'INVALID_PLATFORM',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}, firebaseAuthController.verifyAppleToken);

// PROTECTED ROUTES - Link Firebase with existing account

router.post('/firebase-link', authMiddleware, (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required for linking',
        code: 'MISSING_TOKEN',
      });
    }

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}, firebaseAuthController.linkFirebaseAccount);

module.exports = router;