// ═══════════════════════════════════════════════════════════════════════════
// ROUTES: Google Auth — Google OAuth + Apple Sign-in
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const googleAuthController = require('../controllers/googleAuthController');

// POST /api/auth/google — Google OAuth login
router.post('/google', asyncHandler(googleAuthController.googleLogin));

// POST /api/auth/apple — Apple Sign-in
router.post('/apple', asyncHandler(googleAuthController.appleLogin));

module.exports = router;