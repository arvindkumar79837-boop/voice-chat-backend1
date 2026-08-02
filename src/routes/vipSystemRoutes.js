const express = require('express');
const router = express.Router();
const vipSystem = require('../controllers/vipSystemController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { verifyStaff: adminAuth } = require('../middlewares/adminMiddleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ============================================================
// VIP SYSTEM ROUTES
// Full API for VIP 1-15, SVIP, Premium, Cosmetics, Missions
// ============================================================

// ─── VIP CORE ─────────────────────────────────
router.get('/status', validatePagination(), authMiddleware, vipSystem.getUserVipStatus);
router.post('/xp/add', authMiddleware, validateNumber('xp', { required: true, min: 0 }), validateAllowedFields(['xp']), vipSystem.addVipXP);

// ─── SVIP MANAGEMENT ──────────────────────────
router.post('/svip/activate', authMiddleware, adminAuth, vipSystem.activateSVIP);
router.post('/svip/deactivate', authMiddleware, adminAuth, vipSystem.deactivateSVIP);
router.get('/svip/users', validatePagination(), authMiddleware, adminAuth, vipSystem.listSVIPUsers);

// ─── PREMIUM SUBSCRIPTION ─────────────────────
router.post('/premium/purchase', authMiddleware, validateString('tierId', { required: true }), validateAllowedFields(['tierId']), vipSystem.purchasePremium);
router.post('/premium/cancel-renew', authMiddleware, vipSystem.cancelPremiumAutoRenew);
router.post('/premium/daily-bonus', authMiddleware, validateAllowedFields([]), vipSystem.claimPremiumDailyBonus);

// ─── COSMETICS ────────────────────────────────
router.get('/cosmetics', validatePagination(), authMiddleware, vipSystem.getAvailableCosmetics);
router.post('/cosmetics/purchase', authMiddleware, validateBodyObjectId('cosmeticId'), validateAllowedFields(['cosmeticId']), vipSystem.purchaseCosmetic);
router.post('/cosmetics/apply', authMiddleware, validateString('cosmeticId', { required: true }), validateAllowedFields(['cosmeticId']), vipSystem.applyCosmetic);

// ─── VIP MISSIONS ─────────────────────────────
router.get('/missions', validatePagination(), authMiddleware, vipSystem.getVipMissions);
router.post('/missions/progress', authMiddleware, validateBodyObjectId('missionId'), validateNumber('progress', { required: true, min: 0, max: 100 }), validateAllowedFields(['missionId', 'progress']), vipSystem.updateMissionProgress);
router.post('/missions/claim', authMiddleware, validateBodyObjectId('missionId'), validateAllowedFields(['missionId']), vipSystem.claimMissionReward);

// ─── VIP SHOP ─────────────────────────────────
router.get('/shop', validatePagination(), authMiddleware, vipSystem.getVIPShopItems);

// ─── VIP ENTRY EFFECTS ────────────────────────
router.post('/entry', authMiddleware, validateAllowedFields([]), vipSystem.triggerVIPEntry);

// ─── VIP LEADERBOARD ──────────────────────────
router.get('/leaderboard', validatePagination(), authMiddleware, vipSystem.getVIPLeaderboard);

// ─── ADMIN ROUTES ─────────────────────────────
router.get('/admin/list', validatePagination(), authMiddleware, adminAuth, vipSystem.adminListAllVIP);
router.post('/admin/update-level', authMiddleware, adminAuth, validateBodyObjectId('userId'), validateNumber('level', { required: true, min: 0, max: 15 }), validateAllowedFields(['userId', 'level']), vipSystem.adminUpdateVipLevel);
router.post('/admin/cosmetics', authMiddleware, adminAuth, vipSystem.adminManageCosmetics);

module.exports = router;