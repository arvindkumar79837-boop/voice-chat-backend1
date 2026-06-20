const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const treasuryController = require('../controllers/treasuryController');

// ⚠️ STRICTLY OWNER ONLY ROUTE
router.post('/generate', verifyOwner, treasuryController.generateCoins);
router.get('/logs', verifyOwner, treasuryController.getLogs);

module.exports = router;