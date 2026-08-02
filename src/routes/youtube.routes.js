// ═══════════════════════════════════════════════════════════════════════════
// FILE: arvind-party-backend/src/routes/youtube.routes.js
// ARVIND PARTY - YOUTUBE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtube.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// All routes require auth
router.use(authMiddleware);

// Get room playlist
router.get('/playlist/:roomId', validatePagination(), youtubeController.getPlaylist);

// Search videos
router.get('/search', validatePagination(), youtubeController.searchVideos);

// Add video to playlist (host only)
router.post('/playlist/add', validateString('videoId', { required: true }), validateString('title', { required: true, maxLength: 200 }), youtubeController.addToPlaylist);

// Remove video from playlist (host only)
router.delete('/playlist/:roomId/:videoId', youtubeController.removeFromPlaylist);

// Update playback state (host only)
router.post('/playback/update', validateEnum('action', ['play', 'pause', 'stop', 'skip', 'seek'], { required: true }), youtubeController.updatePlaybackState);

module.exports = router;