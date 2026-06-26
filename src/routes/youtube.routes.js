// ═══════════════════════════════════════════════════════════════════════════
// FILE: arvind-party-backend/src/routes/youtube.routes.js
// ARVIND PARTY - YOUTUBE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtube.controller');
const authMiddleware = require('../middlewares/authMiddleware');

// All routes require auth
router.use(authMiddleware);

// Get room playlist
router.get('/playlist/:roomId', youtubeController.getPlaylist);

// Search videos
router.get('/search', youtubeController.searchVideos);

// Add video to playlist (host only)
router.post('/playlist/add', youtubeController.addToPlaylist);

// Remove video from playlist (host only)
router.delete('/playlist/:roomId/:videoId', youtubeController.removeFromPlaylist);

// Update playback state (host only)
router.post('/playback/update', youtubeController.updatePlaybackState);

module.exports = router;