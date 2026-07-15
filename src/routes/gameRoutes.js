const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');

// Import both game controllers
const gameController = require('../controllers/game.controller');
const gameCtrl = require('../controllers/gameController');

// ─── Web Panel Game CRUD ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  res.json({ success: true, data: [] });
});
router.post('/', async (req, res) => {
  res.json({ success: true, message: 'Game created', data: req.body });
});
router.put('/:id', async (req, res) => {
  res.json({ success: true, message: 'Game updated', data: { id: req.params.id, ...req.body } });
});
router.delete('/:id', async (req, res) => {
  res.json({ success: true, message: 'Game deleted' });
});
router.get('/ledger', async (req, res) => {
  res.json({ success: true, data: [] });
});

router.use(authMiddleware); // Strictly secured for logged-in users only

// ─── Lucky Wheel ──────────────────────────────────────────────────────────
router.get('/lucky-wheel/rewards', gameController.getLuckyWheelRewards);
router.post('/lucky-wheel/spin', gameController.spinLuckyWheel);

// ─── Scratch Card ─────────────────────────────────────────────────────────
router.post('/scratch-card/play', gameCtrl.playScratchCard);

// ─── Leaderboard ──────────────────────────────────────────────────────────
router.get('/leaderboard', gameCtrl.getLeaderboard);

module.exports = router;
