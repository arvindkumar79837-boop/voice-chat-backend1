const express = require('express');
const router = express.Router();
const coinVaultController = require('../controllers/coinVaultController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Existing CoinVault functionality: mint, dispatch, burn, vault info
// Add mobile-facing /api/coin-orders routes without modifying CoinVaultController

router.get('/vault', validatePagination(), authMiddleware, coinVaultController.getVault);
router.post('/mint', authMiddleware, coinVaultController.mintCoins);
router.post('/dispatch', authMiddleware, coinVaultController.dispatchToSeller);
router.post('/burn', authMiddleware, coinVaultController.burnCoins);

// Additional alias for consistency with mobile ApiConstants.coinOrders
router.get('/', validatePagination(), authMiddleware, coinVaultController.getVault);

module.exports = router;