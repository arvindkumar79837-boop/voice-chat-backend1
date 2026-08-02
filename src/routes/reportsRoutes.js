const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const reportsController = require('../controllers/reportsController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.use(authMiddleware);

router.get('/reports/realtime', validatePagination(), reportsController.getRealtimeAnalytics);
router.get('/reports/monthly', validatePagination(), reportsController.getMonthlyReport);
router.get('/reports/daily-chart', validatePagination(), reportsController.getDailyChartData);
router.get('/reports/host-ranking', validatePagination(), reportsController.getHostRanking);

module.exports = router;