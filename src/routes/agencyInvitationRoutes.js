const express = require('express');
const router = express.Router();
const agencyInvitationController = require('../controllers/agencyInvitationController');
const { authMiddleware } = require('../middlewares/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────
// AGENCY INVITATION ROUTES
// ─────────────────────────────────────────────────────────────────────────

// Send invitation to user by UID
router.post('/invitations/send', authMiddleware, agencyInvitationController.sendInvitation);

// Get my inbox (pending invitations)
router.get('/invitations/inbox', authMiddleware, agencyInvitationController.getInbox);

// Accept invitation
router.post('/invitations/accept/:invitationId', authMiddleware, agencyInvitationController.acceptInvitation);

// Reject invitation
router.post('/invitations/reject/:invitationId', authMiddleware, agencyInvitationController.rejectInvitation);

// Search user by UID
router.get('/users/search', authMiddleware, agencyInvitationController.searchUserByUid);

// Get all notifications/inbox
router.get('/inbox', authMiddleware, agencyInvitationController.getNotifications);

// Mark notification as read
router.post('/notifications/read/:notificationId', authMiddleware, agencyInvitationController.markNotificationRead);

// Mark all notifications as read
router.post('/notifications/read-all', authMiddleware, agencyInvitationController.markAllNotificationsRead);

module.exports = router;