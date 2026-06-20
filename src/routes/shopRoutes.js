const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/items', auth, shopController.getItems);
router.post('/purchase', auth, shopController.purchaseItem);

module.exports = router;