// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/socialAuthRoutes.js
// ARVIND PARTY — Social Authentication Routes
// Providers: Google, Apple, Facebook, Snapchat, Instagram, Guest
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middlewares/auth.middleware');
const securityController = require('../controllers/authSecure.controller');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 10,
  message: { success: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL LOGIN
// ═══════════════════════════════════════════════════════════════════════════

router.post('/login', authLimiter, securityController.socialLogin);
router.post('/guest-login', authLimiter, securityController.guestLogin);

// ═══════════════════════════════════════════════════════════════════════════
// LINK / UNLINK SOCIAL ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════

router.post('/link', authMiddleware, securityController.linkSocialAccount);
router.post('/unlink', authMiddleware, securityController.unlinkSocialAccount);

module.exports = router;