const express = require('express');
const router = express.Router();
const levelController = require('../controllers/levelController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/:id/level', validateObjectId('id'), validatePagination(), authMiddleware, levelController.getUserLevel);
router.post('/xp/add', validateNumber('xp', { required: true, min: 0 }), validateAllowedFields(['xp', 'userId']), authMiddleware, levelController.addExperience);

module.exports = router;