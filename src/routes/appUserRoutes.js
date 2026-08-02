const express = require('express');
const router = express.Router();
const appUserController = require('../controllers/appUserController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// App Users Routes — all require authentication
router.use(authMiddleware);

router.post('/join-agency', appUserController.joinAgency);
router.post('/withdraw', appUserController.requestWithdrawal);

module.exports = router;