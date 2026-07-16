const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const shopController = require('../controllers/shop.controller');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');

router.get('/items', auth, asyncHandler(shopController.getItems));
router.post('/purchase', auth, asyncHandler(shopController.purchaseItem));

module.exports = router;