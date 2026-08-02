// ═══════════════════════════════════════════════════════════════════════════
// ROUTES: Google Auth — Google OAuth + Apple Sign-in
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const googleAuthController = require('../controllers/googleAuthController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// POST /api/auth/google — Google OAuth login
router.post('/google', validateString('idToken', { required: true, maxLength: 4096 }), asyncHandler(googleAuthController.googleLogin));

// POST /api/auth/apple — Apple Sign-in
router.post('/apple', validateString('identityToken', { required: true, maxLength: 4096 }), asyncHandler(googleAuthController.appleLogin));

module.exports = router;