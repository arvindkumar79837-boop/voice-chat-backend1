const express = require('express');
const router = express.Router();
const { verifyStaff, verifyOwner } = require('../middlewares/adminMiddleware');
const ctrl = require('../controllers/diamondWithdrawalController');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Staff withdrawal requests
router.post('/request', verifyStaff, ctrl.requestWithdrawal);
router.get('/my-requests', validatePagination(), verifyStaff, ctrl.getMyRequests);
router.put('/:requestId/clear-notification', validateObjectId('requestId'), verifyStaff, ctrl.clearNotification);

// Admin
router.get('/all', validatePagination(), verifyStaff, ctrl.getAllRequests);
router.put('/:requestId/approve', validateObjectId('requestId'), verifyStaff, ctrl.approveRequest);
router.put('/:requestId/mark-paid', validateObjectId('requestId'), verifyStaff, ctrl.markPaid);
router.put('/:requestId/reject', validateObjectId('requestId'), verifyStaff, ctrl.rejectRequest);

module.exports = router;
