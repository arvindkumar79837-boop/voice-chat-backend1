const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC LEADERBOARD ROUTES ────────────────────────────────────────────
router.get('/wealth', authMiddleware, rankingController.getTopWealth);
router.get('/charm', authMiddleware, rankingController.getTopCharm);
router.get('/gifts', authMiddleware, rankingController.getGiftRanking);
router.get('/families', authMiddleware, rankingController.getFamilyRanking);
router.get('/agencies', authMiddleware, rankingController.getAgencyRanking);
router.get('/rooms', authMiddleware, rankingController.getRoomRanking);
router.get('/pk-battles', authMiddleware, rankingController.getPKRanking);
router.get('/rich-list', authMiddleware, rankingController.getRichList);
router.get('/popular-list', authMiddleware, rankingController.getPopularList);
router.get('/my-ranks', authMiddleware, rankingController.getMyRanks);

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────
router.get('/admin/leaderboard', authMiddleware, adminAuth, rankingController.getAdminLeaderboard);
router.post('/admin/reset', authMiddleware, adminAuth, rankingController.resetLeaderboard);
router.get('/admin/stats', authMiddleware, adminAuth, rankingController.getRankingStats);
router.post('/admin/flush-cache', authMiddleware, adminAuth, rankingController.flushRankingCache);

module.exports = router;