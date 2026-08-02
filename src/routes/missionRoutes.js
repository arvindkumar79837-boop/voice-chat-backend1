const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware } = require('../middlewares/auth.middleware');
const missionController = require('../controllers/missionController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/', validatePagination(), authMiddleware, asyncHandler(missionController.getMissions));
router.post('/claim', authMiddleware, validateBodyObjectId('missionId'), validateAllowedFields(['missionId']), asyncHandler(missionController.claimReward));

module.exports = router;
