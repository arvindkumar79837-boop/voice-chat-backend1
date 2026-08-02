const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const attendanceController = require('../controllers/attendanceController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');
router.use(authMiddleware);

router.post('/attendance/start', validateBodyObjectId('roomId'), attendanceController.startSession);
router.post('/attendance/end', validateBodyObjectId('roomId'), attendanceController.endSession);
router.get('/attendance/live', validatePagination(), attendanceController.getLiveAttendance);
router.get('/attendance/monthly', validatePagination(), attendanceController.getMonthlyAttendance);
router.get('/attendance/history/:hostId', validatePagination(), attendanceController.getHostAttendanceHistory);

module.exports = router;