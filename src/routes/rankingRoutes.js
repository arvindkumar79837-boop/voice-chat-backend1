const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');
const auth = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC LEADERBOARD ROUTES ────────────────────────────────────────────
router.get('/wealth', auth, rankingController.getTopWealth);
router.get('/charm', auth, rankingController.getTopCharm);
router.get('/gifts', auth, rankingController.getGiftRanking);
router.get('/families', auth, rankingController.getFamilyRanking);
router.get('/agencies', auth, rankingController.getAgencyRanking);
router.get('/rooms', auth, rankingController.getRoomRanking);
router.get('/pk-battles', auth, rankingController.getPKRanking);
router.get('/rich-list', auth, rankingController.getRichList);
router.get('/popular-list', auth, rankingController.getPopularList);
router.get('/my-ranks', auth, rankingController.getMyRanks);

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────
router.get('/admin/leaderboard', auth, adminAuth, rankingController.getAdminLeaderboard);
router.post('/admin/reset', auth, adminAuth, rankingController.resetLeaderboard);
router.get('/admin/stats', auth, adminAuth, rankingController.getRankingStats);
router.post('/admin/flush-cache', auth, adminAuth, rankingController.flushRankingCache);

module.exports = router;