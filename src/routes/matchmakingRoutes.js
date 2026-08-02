const express = require('express');
const router = express.Router();
const matchmakingController = require('../controllers/matchmaking.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.post('/search', validateEnum('mode', ['solo', 'duo', 'squad'], { required: true }), validateString('gender', { required: false, isIn: ['male', 'female', 'any'] }), authMiddleware, matchmakingController.searchMatch);
router.post('/stop', authMiddleware, matchmakingController.stopSearch);

module.exports = router;