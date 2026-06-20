const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const auth = require('../middlewares/auth.middleware');

router.get('/referral', auth, referralController.getReferralInfo);
router.post('/referral/claim', auth, referralController.claimReward);

module.exports = router;