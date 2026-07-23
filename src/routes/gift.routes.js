const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const giftProductionController = require('../controllers/gift.production.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const Gift = require('../models/Gift');
const GiftEvent = require('../models/GiftEvent');

const giftRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 30,
  message: { success: false, message: 'Too many gift requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Gift Store & Discovery ────────────────────────────────────
router.get('/store', asyncHandler(giftProductionController.getStoreGifts));
router.get('/type/:giftType', asyncHandler(giftProductionController.getGiftsByType));
router.get('/list', authMiddleware, asyncHandler(giftProductionController.getStoreGifts));
router.get('/history', authMiddleware, asyncHandler(giftProductionController.getGiftHistory));
router.get('/leaderboard', asyncHandler(giftProductionController.getGiftLeaderboard));
router.get('/statistics', authMiddleware, asyncHandler(giftProductionController.getGiftStatistics));

// ─── Flutter-compatible catalog, goal, events ──────────────────
router.get('/catalog', authMiddleware, asyncHandler(async (req, res) => {
  const gifts = await Gift.find({ isAvailable: true }).sort({ coinPrice: 1 });
  res.json({ success: true, gifts });
}));

router.get('/goal', authMiddleware, asyncHandler(async (req, res) => {
  const { roomId } = req.query;
  const Room = require('../models/Room');
  let goal = null;
  if (roomId) {
    const room = await Room.findOne({ roomId }).select('giftGoal');
    goal = room?.giftGoal || null;
  }
  res.json({ success: true, goal });
}));

router.get('/events', authMiddleware, asyncHandler(async (req, res) => {
  const activeEvents = await GiftEvent.find({}).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, events: activeEvents });
}));

// ─── Send Gifts (All Types) ────────────────────────────────────
router.post('/send', authMiddleware, giftRateLimit, asyncHandler(giftProductionController.sendGift));
router.post('/combo', authMiddleware, asyncHandler(giftProductionController.sendComboGift));
router.post('/treasure/claim', authMiddleware, asyncHandler(giftProductionController.claimTreasure));

// ─── User Inventory & Collection ──────────────────────────────
router.get('/inventory', authMiddleware, asyncHandler(giftProductionController.getGiftInventory));
router.get('/collection', authMiddleware, asyncHandler(giftProductionController.getGiftCollection));

// ─── Room Gift Goals ──────────────────────────────────────────
router.post('/goals', authMiddleware, asyncHandler(giftProductionController.setGiftGoal));

// ─── Festival Gifts ────────────────────────────────────────────
router.post('/festival', authMiddleware, asyncHandler(giftProductionController.createFestivalGift));

// ─── Admin Gift Management ─────────────────────────────────────
router.put('/:giftId/toggle', authMiddleware, asyncHandler(giftProductionController.toggleGiftAvailability));
router.post('/admin/create', authMiddleware, asyncHandler(giftProductionController.adminCreateGift));
router.put('/admin/:giftId', authMiddleware, asyncHandler(giftProductionController.adminUpdateGift));
router.delete('/admin/:giftId', authMiddleware, asyncHandler(giftProductionController.adminDeleteGift));

module.exports = router;