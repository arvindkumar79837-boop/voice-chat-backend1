// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/auth.routes.js
// ARVIND PARTY - COMPLETE AUTHENTICATION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { validatePhone, validateOTP } = require('../middlewares/validation.middleware');
const authMiddleware = require('../middlewares/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────
// RATE LIMITER — 10 attempts per 15 min (dev-friendly)
// ─────────────────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 10,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/send-otp
 * Body: { phone: "9876543210" }
 * Sends a 6-digit OTP via SMS (or logs it in dev mode).
 */
router.post('/send-otp', authLimiter, validatePhone(), authController.sendOtp);

/**
 * POST /api/auth/otp-verify
 * Body: { phone: "9876543210", otp: "123456" }
 * Verifies OTP → auto-creates user if new → returns JWT + refreshToken.
 * This is the SINGLE entry point for both new and returning users.
 */
router.post('/otp-verify', authLimiter, validatePhone(), validateOTP(), authController.verifyOtp);

/**
 * POST /api/auth/resend-otp
 * Body: { phone: "9876543210" }
 * Resends a fresh OTP (resets the 5-minute TTL).
 */
router.post('/resend-otp', authLimiter, validatePhone(), authController.resendOtp);

/**
 * POST /api/auth/register
 * Body: { phone, name, gender?, dob? }
 * Completes profile after OTP verify when isProfileComplete is false.
 */
router.post('/register', authLimiter, validatePhone(), authController.register);

/**
 * POST /api/auth/refresh-token
 * Body: { refreshToken: "..." }
 * Issues a new access token without re-login.
 */
router.post('/refresh-token', authController.refreshToken);

// ─────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <token>
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 * Returns current authenticated user's profile.
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.userId).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        avatar: user.avatar,
        arvindId: user.arvindId,
        level: user.level,
        xp: user.xp,
        coins: user.coins,
        diamonds: user.diamonds,
        isProfileComplete: user.isProfileComplete,
        gender: user.gender,
        dob: user.dob,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

module.exports = router;
