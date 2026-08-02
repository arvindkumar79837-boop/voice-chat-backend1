const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const treasuryController = require('../controllers/treasuryController');
const coinVaultController = require('../controllers/coinVaultController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ⚠️ STRICTLY OWNER ONLY ROUTE - Legacy treasury
router.post('/generate', validateNumber('coins', { required: true, min: 0 }), verifyOwner, treasuryController.generateCoins);
router.get('/logs', validatePagination(), verifyOwner, treasuryController.getLogs);

// ─── COIN VAULT SYSTEM (Owner-only minting & dispatch) ──────────────────────
router.get('/vault', validatePagination(), verifyOwner, coinVaultController.getVault);
router.post('/vault/mint', verifyOwner, coinVaultController.mintCoins);
router.post('/vault/dispatch', verifyOwner, coinVaultController.dispatchToSeller);
router.post('/vault/burn', verifyOwner, coinVaultController.burnCoins);
router.get('/vault/history', validatePagination(), verifyOwner, coinVaultController.getVaultHistory);

module.exports = router;