const express = require('express');
const router = express.Router();
const giftController = require('../controllers/gift.controller');
const giftProductionController = require('../controllers/gift.production.controller');
const auth = require('../middlewares/auth.middleware');

// ─── Gift Store & Discovery ────────────────────────────────────
router.get('/store', giftProductionController.getStoreGifts);
router.get('/type/:giftType', giftProductionController.getGiftsByType);
router.get('/list', auth, giftController.getGifts);
router.get('/history', auth, giftProductionController.getGiftHistory);
router.get('/leaderboard', giftProductionController.getGiftLeaderboard);
router.get('/statistics', auth, giftProductionController.getGiftStatistics);

// ─── Send Gifts (All Types) ────────────────────────────────────
router.post('/send', auth, giftProductionController.sendGift);
router.post('/combo', auth, giftProductionController.sendComboGift);
router.post('/treasure/claim', auth, giftProductionController.claimTreasure);

// ─── User Inventory & Collection ──────────────────────────────
router.get('/inventory', auth, giftProductionController.getGiftInventory);
router.get('/collection', auth, giftProductionController.getGiftCollection);

// ─── Room Gift Goals ──────────────────────────────────────────
router.post('/goals', auth, giftProductionController.setGiftGoal);

// ─── Festival Gifts ────────────────────────────────────────────
router.post('/festival', auth, giftProductionController.createFestivalGift);

// ─── Admin Gift Management ─────────────────────────────────────
router.put('/:giftId/toggle', auth, giftProductionController.toggleGiftAvailability);
router.post('/admin/create', auth, giftProductionController.adminCreateGift);
router.put('/admin/:giftId', auth, giftProductionController.adminUpdateGift);
router.delete('/admin/:giftId', auth, giftProductionController.adminDeleteGift);

module.exports = router;