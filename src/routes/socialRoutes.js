const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const socialController = require('../controllers/socialController');
const { authMiddleware } = require('../middlewares/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────
// SOCIAL ROUTES
// ─────────────────────────────────────────────────────────────────────────

// Follow user
router.post('/follow/:userId', authMiddleware, asyncHandler(socialController.followUser));

// Unfollow user
router.post('/unfollow/:userId', authMiddleware, asyncHandler(socialController.unfollowUser));

// Get followers list
router.get('/followers/:userId', authMiddleware, asyncHandler(socialController.getFollowers));

// Get following list
router.get('/following/:userId', authMiddleware, asyncHandler(socialController.getFollowing));

// Record profile visit
router.post('/visit/:userId', authMiddleware, asyncHandler(socialController.recordVisit));

// Get visitor history
router.get('/visitors', authMiddleware, asyncHandler(socialController.getVisitorHistory));

// Block user
router.post('/block/:userId', authMiddleware, asyncHandler(socialController.blockUser));

// Unblock user
router.post('/unblock/:userId', authMiddleware, asyncHandler(socialController.unblockUser));

// Get block list
router.get('/block-list', authMiddleware, asyncHandler(socialController.getBlockList));

// Check block status
router.get('/check-block/:userId', authMiddleware, asyncHandler(socialController.checkBlockStatus));

module.exports = router;