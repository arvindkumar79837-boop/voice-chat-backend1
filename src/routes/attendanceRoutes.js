const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const attendanceController = require('../controllers/attendanceController');
const io = require('../../server').io;

attendanceController.ioInstance = io;

router.use(auth);

router.post('/attendance/start', attendanceController.startSession);
router.post('/attendance/end', attendanceController.endSession);
router.get('/attendance/live', attendanceController.getLiveAttendance);
router.get('/attendance/monthly', attendanceController.getMonthlyAttendance);
router.get('/attendance/history/:hostId', attendanceController.getHostAttendanceHistory);

module.exports = router;