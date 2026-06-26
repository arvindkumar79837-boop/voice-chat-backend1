// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/adminAuth.js
// ARVIND PARTY - ADMIN AUTHENTICATION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');

// @route   POST /api/admin/auth/login
// @desc    Initial login step for admin/staff using Firebase UID/idToken
// @access  Public
router.post('/login', adminAuthController.login);

// @route   POST /api/admin/auth/verify-2fa
// @desc    Second login step to verify 2FA OTP for high-privilege accounts
// @access  Public (but requires a valid UID from the first step)
router.post('/verify-2fa', adminAuthController.verifyTwoFactor);

// @route   POST /api/admin/auth/refresh-token
// @desc    Issues a new access token for an admin/staff using a valid refresh token
// @access  Public
router.post('/refresh-token', adminAuthController.refreshToken);


module.exports = router;