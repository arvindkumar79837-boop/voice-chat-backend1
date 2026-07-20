const express = require('express');
const router = express.Router();
const { verifyStaff, verifyOwner } = require('../middlewares/adminMiddleware');
const ctrl = require('../controllers/diamondEconomyController');

router.post('/verify-google-play', ctrl.verifyGooglePlayRecharge);
router.get('/balance', ctrl.getWalletBalance);

module.exports = router;
