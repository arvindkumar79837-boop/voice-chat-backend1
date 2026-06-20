const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

// Import both game controllers
const gameController = require('../controllers/game.controller');
const gameCtrl = require('../controllers/gameController');

router.use(authMiddleware); // Strictly secured for logged-in users only

// ─── Lucky Wheel ──────────────────────────────────────────────────────────
router.get('/lucky-wheel/rewards', gameController.getLuckyWheelRewards);
router.post('/lucky-wheel/spin', gameController.spinLuckyWheel);

// ─── Scratch Card ─────────────────────────────────────────────────────────
router.post('/scratch-card/play', gameCtrl.playScratchCard);

// ─── Leaderboard ──────────────────────────────────────────────────────────
router.get('/leaderboard', gameCtrl.getLeaderboard);

module.exports = router;
