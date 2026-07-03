const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const salaryController = require('../controllers/salaryController');

router.use(authMiddleware);

router.get('/salary/history', salaryController.getSalaryHistory);
router.get('/salary/detail/:hostId', salaryController.getHostSalaryDetail);
router.post('/salary/calculate-monthly/:agencyId', salaryController.calculateMonthlySalary);

module.exports = router;