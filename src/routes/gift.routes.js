const express = require('express');
const router = express.Router();
const giftController = require('../controllers/gift.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/list', auth, giftController.getGifts);
router.post('/send', auth, giftController.sendGift);

module.exports = router;