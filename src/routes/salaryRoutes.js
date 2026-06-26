const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const salaryController = require('../controllers/salaryController');

router.use(auth);

router.get('/salary/history', salaryController.getSalaryHistory);
router.get('/salary/detail/:hostId', salaryController.getHostSalaryDetail);
router.post('/salary/calculate-monthly/:agencyId', salaryController.calculateMonthlySalary);

module.exports = router;