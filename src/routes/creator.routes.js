const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creatorController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/earnings', validatePagination(), authMiddleware, creatorController.getEarnings);
router.get('/analytics', validatePagination(), authMiddleware, creatorController.getAnalytics);
router.post('/withdraw', authMiddleware, creatorController.withdrawEarnings);

module.exports = router;