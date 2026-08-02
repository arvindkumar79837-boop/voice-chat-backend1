const express = require('express');
const router = express.Router();
const { verifyOwner } = require('../middlewares/adminMiddleware');
const coinDistributionController = require('../controllers/coinDistributionController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.post('/generate-for-user', validateBodyObjectId('userId'), validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), verifyOwner, coinDistributionController.generateForUser);
router.post('/distribute', validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), verifyOwner, coinDistributionController.distributeCoins);

module.exports = router;
