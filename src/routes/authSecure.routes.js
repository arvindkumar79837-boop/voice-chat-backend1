const express = require('express');
const router = express.Router();
const controller = require('../controllers/authSecure.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.post('/logout', validateRefreshToken(), authMiddleware, controller.logoutDevice);
router.post('/revoke-all-sessions', validateRefreshToken(), authMiddleware, controller.logoutDevice);
router.post('/admin/revoke-user-sessions', validateRefreshToken(), authMiddleware, controller.logoutDevice);

module.exports = router;
