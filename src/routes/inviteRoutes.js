const express = require('express');
const router = express.Router();
const inviteEventController = require('../controllers/inviteEventController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.post('/generate', authMiddleware, inviteEventController.generateInviteLink);
router.post('/register', validateString('inviteCode', { required: true }), authMiddleware, inviteEventController.registerViaInvite);
router.post('/commission', validateNumber('amount', { required: false, min: 0 }), authMiddleware, inviteEventController.processRechargeCommission);
router.get('/my-stats', validatePagination(), authMiddleware, inviteEventController.getMyInviteStats);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', validatePagination(), authMiddleware, adminAuth, inviteEventController.adminGetAllInvites);
router.put('/admin/:inviteId/commission', authMiddleware, adminAuth, inviteEventController.adminUpdateCommission);

module.exports = router;