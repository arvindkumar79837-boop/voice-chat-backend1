const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── PUBLIC LEADERBOARD ROUTES ────────────────────────────────────────────
router.get('/wealth', validatePagination(), authMiddleware, rankingController.getTopWealth);
router.get('/charm', validatePagination(), authMiddleware, rankingController.getTopCharm);
router.get('/gifts', validatePagination(), authMiddleware, rankingController.getGiftRanking);
router.get('/families', validatePagination(), authMiddleware, rankingController.getFamilyRanking);
router.get('/agencies', validatePagination(), authMiddleware, rankingController.getAgencyRanking);
router.get('/rooms', validatePagination(), authMiddleware, rankingController.getRoomRanking);
router.get('/pk-battles', validatePagination(), authMiddleware, rankingController.getPKRanking);
router.get('/rich-list', validatePagination(), authMiddleware, rankingController.getRichList);
router.get('/popular-list', validatePagination(), authMiddleware, rankingController.getPopularList);
router.get('/my-ranks', validatePagination(), authMiddleware, rankingController.getMyRanks);

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────
router.get('/admin/leaderboard', validatePagination(), authMiddleware, adminAuth, rankingController.getAdminLeaderboard);
router.post('/admin/reset', authMiddleware, adminAuth, validateAllowedFields([]), rankingController.resetLeaderboard);
router.get('/admin/stats', validatePagination(), authMiddleware, adminAuth, rankingController.getRankingStats);
router.post('/admin/flush-cache', authMiddleware, adminAuth, validateAllowedFields([]), rankingController.flushRankingCache);

module.exports = router;