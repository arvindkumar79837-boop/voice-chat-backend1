// ═══════════════════════════════════════════════════════════════════════════
// ROUTES: Google Auth — Google OAuth + Apple Sign-in
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const googleAuthController = require('../controllers/googleAuthController');

// POST /api/auth/google — Google OAuth login
router.post('/google', googleAuthController.googleLogin);

// POST /api/auth/apple — Apple Sign-in
router.post('/apple', googleAuthController.appleLogin);

module.exports = router;