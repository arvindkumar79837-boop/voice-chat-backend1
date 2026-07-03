const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const attendanceController = require('../controllers/attendanceController');
router.use(authMiddleware);

router.post('/attendance/start', attendanceController.startSession);
router.post('/attendance/end', attendanceController.endSession);
router.get('/attendance/live', attendanceController.getLiveAttendance);
router.get('/attendance/monthly', attendanceController.getMonthlyAttendance);
router.get('/attendance/history/:hostId', attendanceController.getHostAttendanceHistory);

module.exports = router;