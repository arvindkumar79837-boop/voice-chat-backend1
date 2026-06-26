const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const { authMiddleware } = require('../middlewares/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────
// SOCIAL ROUTES
// ─────────────────────────────────────────────────────────────────────────

// Follow user
router.post('/follow/:userId', authMiddleware, socialController.followUser);

// Unfollow user
router.post('/unfollow/:userId', authMiddleware, socialController.unfollowUser);

// Get followers list
router.get('/followers/:userId', authMiddleware, socialController.getFollowers);

// Get following list
router.get('/following/:userId', authMiddleware, socialController.getFollowing);

// Record profile visit
router.post('/visit/:userId', authMiddleware, socialController.recordVisit);

// Get visitor history
router.get('/visitors', authMiddleware, socialController.getVisitorHistory);

// Block user
router.post('/block/:userId', authMiddleware, socialController.blockUser);

// Unblock user
router.post('/unblock/:userId', authMiddleware, socialController.unblockUser);

// Get block list
router.get('/block-list', authMiddleware, socialController.getBlockList);

// Check block status
router.get('/check-block/:userId', authMiddleware, socialController.checkBlockStatus);

module.exports = router;