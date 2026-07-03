const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/referral', authMiddleware, referralController.getReferralInfo);
router.post('/referral/claim', authMiddleware, referralController.claimReward);

module.exports = router;