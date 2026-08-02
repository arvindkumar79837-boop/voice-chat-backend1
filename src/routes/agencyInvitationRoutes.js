const express = require('express');
const router = express.Router();
const agencyInvitationController = require('../controllers/agencyInvitationController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─────────────────────────────────────────────────────────────────────────
// AGENCY INVITATION ROUTES
// ─────────────────────────────────────────────────────────────────────────

// Send invitation to user by UID
router.post('/invitations/send', authMiddleware, agencyInvitationController.sendInvitation);

// Get my inbox (pending invitations)
router.get('/invitations/inbox', validatePagination(), authMiddleware, agencyInvitationController.getInbox);

// Accept invitation
router.post('/invitations/accept/:invitationId', validateObjectId('invitationId'), authMiddleware, agencyInvitationController.acceptInvitation);

// Reject invitation
router.post('/invitations/reject/:invitationId', validateObjectId('invitationId'), authMiddleware, agencyInvitationController.rejectInvitation);

// Search user by UID
router.get('/users/search', validatePagination(), authMiddleware, agencyInvitationController.searchUserByUid);

// Get all notifications/inbox
router.get('/inbox', validatePagination(), authMiddleware, agencyInvitationController.getNotifications);

// Mark notification as read
router.post('/notifications/read/:notificationId', validateObjectId('notificationId'), authMiddleware, agencyInvitationController.markNotificationRead);

// Mark all notifications as read
router.post('/notifications/read-all', authMiddleware, agencyInvitationController.markAllNotificationsRead);

module.exports = router;