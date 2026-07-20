const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/premiumSubscriptionController');
const { authMiddleware, verifyStaff } = require('../middlewares/adminMiddleware');

// ─── ADMIN/OWNER: Tier CRUD ───────────────────────────────────────
router.post('/tiers',        authMiddleware, verifyStaff, ctrl.createTier);
router.put('/tiers/:tierId', authMiddleware, verifyStaff, ctrl.updateTier);
router.delete('/tiers/:tierId', authMiddleware, verifyStaff, ctrl.deleteTier);
router.get('/tiers',         ctrl.listTiers);
router.get('/tiers/:tierId', ctrl.getTier);

// ─── USER: Subscription ───────────────────────────────────────────
router.post('/verify-play-subscription', authMiddleware, ctrl.verifyPlaySubscription);
router.post('/claim-monthly-coins',      authMiddleware, ctrl.claimMonthlyCoins);
router.get('/my-subscription',           authMiddleware, ctrl.getMySubscription);

module.exports = router;
