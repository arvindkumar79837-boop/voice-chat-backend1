const express = require('express');
const router = express.Router();
const momentController = require('../controllers/momentController');
const authMiddleware = require('../middlewares/auth.middleware');

// All moment routes require authentication
router.use(authMiddleware);

router.get('/', momentController.getMomentsFeed);
router.post('/create', momentController.createMoment);
router.get('/:momentId', momentController.getMoment);
router.post('/:momentId/like', momentController.likeMoment);
router.post('/:momentId/unlike', momentController.unlikeMoment);
router.post('/:momentId/comment', momentController.addComment);
router.delete('/:momentId/comment/:commentId', momentController.deleteComment);
router.delete('/:momentId', momentController.deleteMoment);
router.get('/search', momentController.searchMoments);

module.exports = router;