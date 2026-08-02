const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const penaltyController = require('../controllers/penaltyController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.use(authMiddleware);

router.post('/penalty/apply', validateBodyObjectId('userId'), validateNumber('amount', { required: false, min: 0 }), validateEnum('type', ['coins', 'diamonds', 'ban', 'mute'], { required: true }), penaltyController.applyPenalty);
router.get('/penalty/history/:hostId', validatePagination(), penaltyController.getHostPenalties);
router.delete('/penalty/:penaltyId', penaltyController.removePenalty);
router.get('/penalty/summary', validatePagination(), penaltyController.getMonthlyPenaltySummary);

module.exports = router;