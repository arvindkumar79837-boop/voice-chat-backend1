const express = require('express');
const router = express.Router();
const cpController = require('../controllers/cpController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/mine', validatePagination(), authMiddleware, cpController.getMyCp);
router.post('/bind', validateEnum('status', ['single', 'couple'], { required: true }), authMiddleware, cpController.bindCp);

module.exports = router;