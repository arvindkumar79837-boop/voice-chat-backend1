const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const shopController = require('../controllers/shop.controller');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');

const shopRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 20,
  message: { success: false, message: 'Too many purchase requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/items', auth, asyncHandler(shopController.getItems));
router.post('/purchase', auth, shopRateLimit, asyncHandler(shopController.purchaseItem));

module.exports = router;