// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/adminAuth.js
// ARVIND PARTY - ADMIN AUTHENTICATION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// @route   POST /api/admin/auth/login
// @desc    Initial login step for admin/staff using Firebase UID/idToken
// @access  Public
router.post('/login', validateEmail(), validateString('password', { required: true, minLength: 6, maxLength: 128 }), adminAuthController.login);

// @route   POST /api/admin/auth/verify-2fa
// @desc    Second login step to verify 2FA OTP for high-privilege accounts
// @access  Public (but requires a valid UID from the first step)
router.post('/verify-2fa', validateOTP(), adminAuthController.verifyTwoFactor);

// @route   POST /api/admin/auth/refresh-token
// @desc    Issues a new access token for an admin/staff using a valid refresh token
// @access  Public
router.post('/refresh-token', validateRefreshToken(), adminAuthController.refreshToken);


module.exports = router;