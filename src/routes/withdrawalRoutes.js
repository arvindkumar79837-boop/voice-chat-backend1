const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const withdrawalController = require('../controllers/withdrawalController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.use(authMiddleware);

router.post('/withdrawal/request', withdrawalController.requestWithdrawal);
router.get('/withdrawal/history', withdrawalController.getWithdrawalHistory);
router.post('/withdrawal/approve/:id', validateObjectId('id'), verifyStaff, withdrawalController.approveWithdrawal);
router.post('/withdrawal/reject/:id', validateObjectId('id'), verifyStaff, withdrawalController.rejectWithdrawal);

module.exports = router;