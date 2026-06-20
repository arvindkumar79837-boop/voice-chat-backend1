const express = require('express');
const router = express.Router();
const vipController = require('../controllers/vipController');
const auth = require('../middlewares/auth.middleware');

router.get('/plans', auth, vipController.getVipPlans);
router.post('/buy', auth, vipController.buyVip);

module.exports = router;