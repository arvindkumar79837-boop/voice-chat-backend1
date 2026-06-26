const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const treasuryController = require('../controllers/treasuryController');
const coinVaultController = require('../controllers/coinVaultController');

// ⚠️ STRICTLY OWNER ONLY ROUTE - Legacy treasury
router.post('/generate', verifyOwner, treasuryController.generateCoins);
router.get('/logs', verifyOwner, treasuryController.getLogs);

// ─── COIN VAULT SYSTEM (Owner-only minting & dispatch) ──────────────────────
router.get('/vault', verifyOwner, coinVaultController.getVault);
router.post('/vault/mint', verifyOwner, coinVaultController.mintCoins);
router.post('/vault/dispatch', verifyOwner, coinVaultController.dispatchToSeller);
router.post('/vault/burn', verifyOwner, coinVaultController.burnCoins);
router.get('/vault/history', verifyOwner, coinVaultController.getVaultHistory);

module.exports = router;