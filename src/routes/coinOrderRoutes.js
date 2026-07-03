const express = require('express');
const router = express.Router();
const coinVaultController = require('../controllers/coinVaultController');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Existing CoinVault functionality: mint, dispatch, burn, vault info
// Add mobile-facing /api/coin-orders routes without modifying CoinVaultController

router.get('/vault', authMiddleware, coinVaultController.getVault);
router.post('/mint', authMiddleware, coinVaultController.mintCoins);
router.post('/dispatch', authMiddleware, coinVaultController.dispatchToSeller);
router.post('/burn', authMiddleware, coinVaultController.burnCoins);

// Additional alias for consistency with mobile ApiConstants.coinOrders
router.get('/', authMiddleware, coinVaultController.getVault);

module.exports = router;