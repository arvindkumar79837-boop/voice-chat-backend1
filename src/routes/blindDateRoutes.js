const express = require('express');
const router = express.Router();
const matchmakingController = require('../controllers/matchmaking.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Alias routes for mobile app compatibility
// Mobile expects: /api/blind-date/match and /api/blind-date/stop
// Backend canonical: /api/matchmaking/search and /api/matchmaking/stop

router.post('/match', authMiddleware, matchmakingController.searchMatch);
router.post('/stop', authMiddleware, matchmakingController.stopSearch);

module.exports = router;