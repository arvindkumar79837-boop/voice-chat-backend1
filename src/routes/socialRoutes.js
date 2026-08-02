const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const socialController = require('../controllers/socialController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─────────────────────────────────────────────────────────────────────────
// SOCIAL ROUTES
// ─────────────────────────────────────────────────────────────────────────

// Follow user
router.post('/follow/:userId', validateObjectId('userId'), authMiddleware, asyncHandler(socialController.followUser));

// Unfollow user
router.post('/unfollow/:userId', validateObjectId('userId'), authMiddleware, asyncHandler(socialController.unfollowUser));

// Get followers list
router.get('/followers/:userId', validatePagination(), authMiddleware, asyncHandler(socialController.getFollowers));

// Get following list
router.get('/following/:userId', validatePagination(), authMiddleware, asyncHandler(socialController.getFollowing));

// Record profile visit
router.post('/visit/:userId', validateObjectId('userId'), authMiddleware, asyncHandler(socialController.recordVisit));

// Get visitor history
router.get('/visitors', validatePagination(), authMiddleware, asyncHandler(socialController.getVisitorHistory));

// Block user
router.post('/block/:userId', validateObjectId('userId'), authMiddleware, asyncHandler(socialController.blockUser));

// Unblock user
router.post('/unblock/:userId', validateObjectId('userId'), authMiddleware, asyncHandler(socialController.unblockUser));

// Get block list
router.get('/block-list', validatePagination(), authMiddleware, asyncHandler(socialController.getBlockList));

// Check block status
router.get('/check-block/:userId', validatePagination(), authMiddleware, asyncHandler(socialController.checkBlockStatus));

module.exports = router;