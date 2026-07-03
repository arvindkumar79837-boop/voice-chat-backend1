const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const reportsController = require('../controllers/reportsController');

router.use(authMiddleware);

router.get('/reports/realtime', reportsController.getRealtimeAnalytics);
router.get('/reports/monthly', reportsController.getMonthlyReport);
router.get('/reports/daily-chart', reportsController.getDailyChartData);
router.get('/reports/host-ranking', reportsController.getHostRanking);

module.exports = router;