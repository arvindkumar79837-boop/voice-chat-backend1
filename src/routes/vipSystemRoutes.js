const express = require('express');
const router = express.Router();
const vipSystem = require('../controllers/vipSystemController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { verifyStaff: adminAuth } = require('../middlewares/adminMiddleware');

// ============================================================
// VIP SYSTEM ROUTES
// Full API for VIP 1-15, SVIP, Premium, Cosmetics, Missions
// ============================================================

// ─── VIP CORE ─────────────────────────────────
router.get('/status', authMiddleware, vipSystem.getUserVipStatus);
router.post('/xp/add', authMiddleware, vipSystem.addVipXP);

// ─── SVIP MANAGEMENT ──────────────────────────
router.post('/svip/activate', authMiddleware, adminAuth, vipSystem.activateSVIP);
router.post('/svip/deactivate', authMiddleware, adminAuth, vipSystem.deactivateSVIP);
router.get('/svip/users', authMiddleware, adminAuth, vipSystem.listSVIPUsers);

// ─── PREMIUM SUBSCRIPTION ─────────────────────
router.post('/premium/purchase', authMiddleware, vipSystem.purchasePremium);
router.post('/premium/cancel-renew', authMiddleware, vipSystem.cancelPremiumAutoRenew);
router.post('/premium/daily-bonus', authMiddleware, vipSystem.claimPremiumDailyBonus);

// ─── COSMETICS ────────────────────────────────
router.get('/cosmetics', authMiddleware, vipSystem.getAvailableCosmetics);
router.post('/cosmetics/purchase', authMiddleware, vipSystem.purchaseCosmetic);
router.post('/cosmetics/apply', authMiddleware, vipSystem.applyCosmetic);

// ─── VIP MISSIONS ─────────────────────────────
router.get('/missions', authMiddleware, vipSystem.getVipMissions);
router.post('/missions/progress', authMiddleware, vipSystem.updateMissionProgress);
router.post('/missions/claim', authMiddleware, vipSystem.claimMissionReward);

// ─── VIP SHOP ─────────────────────────────────
router.get('/shop', authMiddleware, vipSystem.getVIPShopItems);

// ─── VIP ENTRY EFFECTS ────────────────────────
router.post('/entry', authMiddleware, vipSystem.triggerVIPEntry);

// ─── VIP LEADERBOARD ──────────────────────────
router.get('/leaderboard', authMiddleware, vipSystem.getVIPLeaderboard);

// ─── ADMIN ROUTES ─────────────────────────────
router.get('/admin/list', authMiddleware, adminAuth, vipSystem.adminListAllVIP);
router.post('/admin/update-level', authMiddleware, adminAuth, vipSystem.adminUpdateVipLevel);
router.post('/admin/cosmetics', authMiddleware, adminAuth, vipSystem.adminManageCosmetics);

module.exports = router;