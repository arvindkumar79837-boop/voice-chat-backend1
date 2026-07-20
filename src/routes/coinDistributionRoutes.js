const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const coinDistributionController = require('../controllers/coinDistributionController');

router.post('/generate-for-user', verifyOwner, coinDistributionController.generateForUser);
router.post('/distribute', verifyOwner, coinDistributionController.distributeCoins);

module.exports = router;
