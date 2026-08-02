const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const shopController = require('../controllers/shop.controller');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

const shopRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 20,
  message: { success: false, message: 'Too many purchase requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/items', validatePagination(), auth, asyncHandler(shopController.getItems));
router.post('/purchase', validateBodyObjectId('itemId'), validateNumber('quantity', { required: true, min: 1 }), validateAllowedFields(['itemId', 'quantity']), auth, shopRateLimit, asyncHandler(shopController.purchaseItem));

module.exports = router;