const express = require('express');
const router = express.Router();
const rewardInjectorController = require('../controllers/rewardInjectorController');
const rewardConfigController = require('../controllers/rewardConfigController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Public/User-facing reward endpoints
// GET /api/rewards → active reward configurations
router.get('/active', validatePagination(), authMiddleware, rewardConfigController.getActiveLuckyDraws);

// User-specific reward endpoints
router.get('/user', validatePagination(), authMiddleware, rewardInjectorController.getUserRewards);
router.get('/history', validatePagination(), authMiddleware, rewardInjectorController.getRewardHistory);

// Base alias
router.get('/', validatePagination(), authMiddleware, rewardConfigController.getActiveLuckyDraws);

module.exports = router;