const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/diamondEconomyController');

router.post('/verify-google-play', authMiddleware, ctrl.verifyGooglePlayRecharge);
router.get('/balance', authMiddleware, ctrl.getWalletBalance);

module.exports = router;
