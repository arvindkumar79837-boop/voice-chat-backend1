const express = require('express');
const router = express.Router();
const vipSystem = require('../controllers/vipSystemController');
const auth = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/adminMiddleware');

// ============================================================
// VIP SYSTEM ROUTES
// Full API for VIP 1-15, SVIP, Premium, Cosmetics, Missions
// ============================================================

// ─── VIP CORE ─────────────────────────────────
router.get('/status', auth, vipSystem.getUserVipStatus);
router.post('/xp/add', auth, vipSystem.addVipXP);

// ─── SVIP MANAGEMENT ──────────────────────────
router.post('/svip/activate', auth, adminAuth, vipSystem.activateSVIP);
router.post('/svip/deactivate', auth, adminAuth, vipSystem.deactivateSVIP);
router.get('/svip/users', auth, adminAuth, vipSystem.listSVIPUsers);

// ─── PREMIUM SUBSCRIPTION ─────────────────────
router.post('/premium/purchase', auth, vipSystem.purchasePremium);
router.post('/premium/cancel-renew', auth, vipSystem.cancelPremiumAutoRenew);
router.post('/premium/daily-bonus', auth, vipSystem.claimPremiumDailyBonus);

// ─── COSMETICS ────────────────────────────────
router.get('/cosmetics', auth, vipSystem.getAvailableCosmetics);
router.post('/cosmetics/purchase', auth, vipSystem.purchaseCosmetic);
router.post('/cosmetics/apply', auth, vipSystem.applyCosmetic);

// ─── VIP MISSIONS ─────────────────────────────
router.get('/missions', auth, vipSystem.getVipMissions);
router.post('/missions/progress', auth, vipSystem.updateMissionProgress);
router.post('/missions/claim', auth, vipSystem.claimMissionReward);

// ─── VIP SHOP ─────────────────────────────────
router.get('/shop', auth, vipSystem.getVIPShopItems);

// ─── VIP ENTRY EFFECTS ────────────────────────
router.post('/entry', auth, vipSystem.triggerVIPEntry);

// ─── VIP LEADERBOARD ──────────────────────────
router.get('/leaderboard', auth, vipSystem.getVIPLeaderboard);

// ─── ADMIN ROUTES ─────────────────────────────
router.get('/admin/list', auth, adminAuth, vipSystem.adminListAllVIP);
router.post('/admin/update-level', auth, adminAuth, vipSystem.adminUpdateVipLevel);
router.post('/admin/cosmetics', auth, adminAuth, vipSystem.adminManageCosmetics);

module.exports = router;