const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creatorController');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/earnings', authMiddleware, creatorController.getEarnings);
router.get('/analytics', authMiddleware, creatorController.getAnalytics);
router.post('/withdraw', authMiddleware, creatorController.withdrawEarnings);

module.exports = router;