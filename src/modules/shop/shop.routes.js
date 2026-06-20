const express = require('express');
const router = express.Router();
const shopController = require('./shop.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.get('/frames', shopController.getAllFrames);
router.post('/buy-frame', authMiddleware, shopController.buyFrame);

module.exports = router;