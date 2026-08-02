const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const salaryController = require('../controllers/salaryController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.use(authMiddleware);

router.get('/salary/history', validatePagination(), salaryController.getSalaryHistory);
router.get('/salary/detail/:hostId', validatePagination(), salaryController.getHostSalaryDetail);
router.post('/salary/calculate-monthly/:agencyId', validateObjectId('agencyId'), salaryController.calculateMonthlySalary);

module.exports = router;