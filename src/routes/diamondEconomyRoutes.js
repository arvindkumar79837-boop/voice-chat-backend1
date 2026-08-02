const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/diamondEconomyController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.post('/verify-google-play', authMiddleware, ctrl.verifyGooglePlayRecharge);
router.get('/balance', authMiddleware, ctrl.getWalletBalance);

module.exports = router;
