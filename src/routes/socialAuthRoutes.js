// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/socialAuthRoutes.js
// ARVIND PARTY — Social Authentication Routes
// Providers: Google, Apple, Facebook, Snapchat, Instagram, Guest
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middlewares/auth.middleware');
const securityController = require('../controllers/authSecure.controller');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

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

router.post('/login', validateEnum('provider', ['google', 'apple', 'facebook', 'snapchat', 'instagram', 'phone'], { required: true }), validateString('idToken', { required: true, maxLength: 4096 }), validateAllowedFields(['provider', 'idToken', 'deviceInfo']), authLimiter, securityController.socialLogin);
router.post('/guest-login', authLimiter, securityController.guestLogin);

// ═══════════════════════════════════════════════════════════════════════════
// LINK / UNLINK SOCIAL ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════

router.post('/link', validateEnum('provider', ['google', 'apple', 'facebook', 'snapchat', 'instagram', 'phone'], { required: true }), validateString('idToken', { required: true, maxLength: 4096 }), validateAllowedFields(['provider', 'idToken']), authMiddleware, securityController.linkSocialAccount);
router.post('/unlink', validateEnum('provider', ['google', 'apple', 'facebook', 'snapchat', 'instagram'], { required: true }), validateAllowedFields(['provider']), authMiddleware, securityController.unlinkSocialAccount);

module.exports = router;