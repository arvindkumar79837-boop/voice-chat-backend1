const express = require('express');
const router = express.Router();
const giftController = require('../controllers/gift.controller');
const giftProductionController = require('../controllers/gift.production.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// ─── Gift Store & Discovery ────────────────────────────────────
router.get('/store', giftProductionController.getStoreGifts);
router.get('/type/:giftType', giftProductionController.getGiftsByType);
router.get('/list', authMiddleware, giftProductionController.getStoreGifts);
router.get('/history', authMiddleware, giftProductionController.getGiftHistory);
router.get('/leaderboard', giftProductionController.getGiftLeaderboard);
router.get('/statistics', authMiddleware, giftProductionController.getGiftStatistics);

// ─── Send Gifts (All Types) ────────────────────────────────────
router.post('/send', authMiddleware, giftProductionController.sendGift);
router.post('/combo', authMiddleware, giftProductionController.sendComboGift);
router.post('/treasure/claim', authMiddleware, giftProductionController.claimTreasure);

// ─── User Inventory & Collection ──────────────────────────────
router.get('/inventory', authMiddleware, giftProductionController.getGiftInventory);
router.get('/collection', authMiddleware, giftProductionController.getGiftCollection);

// ─── Room Gift Goals ──────────────────────────────────────────
router.post('/goals', authMiddleware, giftProductionController.setGiftGoal);

// ─── Festival Gifts ────────────────────────────────────────────
router.post('/festival', authMiddleware, giftProductionController.createFestivalGift);

// ─── Admin Gift Management ─────────────────────────────────────
router.put('/:giftId/toggle', authMiddleware, giftProductionController.toggleGiftAvailability);
router.post('/admin/create', authMiddleware, giftProductionController.adminCreateGift);
router.put('/admin/:giftId', authMiddleware, giftProductionController.adminUpdateGift);
router.delete('/admin/:giftId', authMiddleware, giftProductionController.adminDeleteGift);

module.exports = router;