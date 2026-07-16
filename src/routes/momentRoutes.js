const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const momentController = require('../controllers/momentController');
const { authMiddleware } = require('../middlewares/auth.middleware');

// All moment routes require authentication
router.use(authMiddleware);

router.get('/', asyncHandler(momentController.getMomentsFeed));
router.post('/create', asyncHandler(momentController.createMoment));
router.get('/search', asyncHandler(momentController.searchMoments));
router.get('/:momentId', asyncHandler(momentController.getMoment));
router.post('/:momentId/like', asyncHandler(momentController.likeMoment));
router.post('/:momentId/unlike', asyncHandler(momentController.unlikeMoment));
router.post('/:momentId/comment', asyncHandler(momentController.addComment));
router.delete('/:momentId/comment/:commentId', asyncHandler(momentController.deleteComment));
router.delete('/:momentId', asyncHandler(momentController.deleteMoment));

module.exports = router;