const express = require('express');
const router = express.Router();
const { verifyStaff, verifyOwner } = require('../middlewares/adminMiddleware');
const ctrl = require('../controllers/diamondWithdrawalController');

// Staff withdrawal requests
router.post('/request', verifyStaff, ctrl.requestWithdrawal);
router.get('/my-requests', verifyStaff, ctrl.getMyRequests);
router.put('/:requestId/clear-notification', verifyStaff, ctrl.clearNotification);

// Admin
router.get('/all', verifyStaff, ctrl.getAllRequests);
router.put('/:requestId/approve', verifyStaff, ctrl.approveRequest);
router.put('/:requestId/mark-paid', verifyStaff, ctrl.markPaid);
router.put('/:requestId/reject', verifyStaff, ctrl.rejectRequest);

module.exports = router;
