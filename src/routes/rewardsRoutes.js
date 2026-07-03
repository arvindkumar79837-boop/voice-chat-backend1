const express = require('express');
const router = express.Router();
const rewardInjectorController = require('../controllers/rewardInjectorController');
const rewardConfigController = require('../controllers/rewardConfigController');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Public/User-facing reward endpoints
// GET /api/rewards → active reward configurations
router.get('/active', authMiddleware, rewardConfigController.getActiveLuckyDraws);

// User-specific reward endpoints
router.get('/user', authMiddleware, rewardInjectorController.getUserRewards);
router.get('/history', authMiddleware, rewardInjectorController.getRewardHistory);

// Base alias
router.get('/', authMiddleware, rewardConfigController.getActiveLuckyDraws);

module.exports = router;