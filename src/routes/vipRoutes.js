const express = require('express');
const router = express.Router();
const vipController = require('../controllers/vipController');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/plans', validatePagination(), auth, vipController.getVipPlans);
router.post('/buy', auth, validateString('planId', { required: true }), validateAllowedFields(['planId']), vipController.buyVip);

module.exports = router;