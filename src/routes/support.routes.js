const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// FAQ Routes
router.get('/faq', validatePagination(), supportController.getFAQs);

// Support Tickets (User & Admin)
router.get('/tickets', validatePagination(), authMiddleware, supportController.getTickets);
router.post('/ticket/create', authMiddleware, validateString('subject', { required: true, maxLength: 200 }), validateString('message', { required: true, maxLength: 1000 }), validateEnum('category', ['technical', 'billing', 'account', 'other'], { required: true }), validateAllowedFields(['subject', 'message', 'category']), supportController.createTicket);
router.post('/ticket/reply', authMiddleware, validateBodyObjectId('ticketId'), validateString('message', { required: true, maxLength: 1000 }), validateAllowedFields(['ticketId', 'message']), supportController.replyToTicket);
router.post('/message', authMiddleware, validateBodyObjectId('receiverId'), validateString('content', { required: true, maxLength: 500 }), validateAllowedFields(['receiverId', 'content']), supportController.sendMessage);

// Profile & Social
router.post('/profile/update', authMiddleware, validateString('name', { required: false, maxLength: 50 }), validateString('bio', { required: false, maxLength: 500 }), validateAllowedFields(['name', 'bio', 'avatar', 'gender', 'dob']), supportController.updateProfile);
router.post('/profile/delete', authMiddleware, require('../controllers/auth.controller').deleteAccount);
router.post('/follow', authMiddleware, validateBodyObjectId('userId'), validateAllowedFields(['userId']), supportController.followUser);
router.get('/search', validatePagination(), authMiddleware, supportController.searchUsers);

// Privacy & Block List
router.put('/privacy/toggle', authMiddleware, validateBoolean('showOnlineStatus'), validateBoolean('showLastSeen'), validateBoolean('showProfile'), validateAllowedFields(['showOnlineStatus', 'showLastSeen', 'showProfile']), supportController.togglePrivacy);
router.get('/blocked', validatePagination(), authMiddleware, supportController.getBlockedUsers);
router.post('/block', authMiddleware, validateBodyObjectId('userId'), validateAllowedFields(['userId']), supportController.addBlockedUser);
router.post('/unblock', authMiddleware, validateBodyObjectId('userId'), validateAllowedFields(['userId']), supportController.removeBlockedUser);
router.get('/check-block', validatePagination(), authMiddleware, supportController.checkBlockStatus);

// Visitor History
router.get('/visitors', validatePagination(), authMiddleware, supportController.getVisitorHistory);
router.post('/visitors/record', validateBodyObjectId('targetUserId'), validateAllowedFields(['targetUserId']), supportController.recordVisitor);

module.exports = router;