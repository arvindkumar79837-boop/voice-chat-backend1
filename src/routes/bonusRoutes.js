const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const bonusController = require('../controllers/bonusController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.use(authMiddleware);

router.post('/bonus/award', validateBodyObjectId('userId'), validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), bonusController.awardBonus);
router.get('/bonus/history/:hostId', validatePagination(), bonusController.getHostBonuses);
router.get('/bonus/summary', validatePagination(), bonusController.getMonthlyBonusSummary);
router.delete('/bonus/:bonusId', bonusController.removeBonus);

module.exports = router;