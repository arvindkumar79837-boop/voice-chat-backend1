const express = require('express');
const router = express.Router();
const luckyDrawController = require('../controllers/luckyDrawController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Mobile aliases for lucky-draw paths
// Mobile expects: /api/lucky-draw/rewards and /api/lucky-draw/spin
// Backend canonical: /api/lucky-draws/active and /api/lucky-draws/:drawId/spin

router.get('/rewards', authMiddleware, luckyDrawController.getActiveLuckyDraws);
router.post('/spin', authMiddleware, luckyDrawController.spinWheel);

module.exports = router;