const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { authMiddleware } = require('../middlewares/auth.middleware');

// FAQ Routes
router.get('/faq', supportController.getFAQs);

// Support Tickets (User & Admin)
router.get('/tickets', authMiddleware, supportController.getTickets);
router.post('/ticket/create', authMiddleware, supportController.createTicket);
router.post('/ticket/reply', authMiddleware, supportController.replyToTicket);
router.post('/message', authMiddleware, supportController.sendMessage);

// Profile & Social
router.post('/profile/update', authMiddleware, supportController.updateProfile);
router.post('/profile/delete', authMiddleware, require('../controllers/auth.controller').deleteAccount);
router.post('/follow', authMiddleware, supportController.followUser);
router.get('/search', authMiddleware, supportController.searchUsers);

// Privacy & Block List
router.put('/privacy/toggle', authMiddleware, supportController.togglePrivacy);
router.get('/blocked', authMiddleware, supportController.getBlockedUsers);
router.post('/block', authMiddleware, supportController.addBlockedUser);
router.post('/unblock', authMiddleware, supportController.removeBlockedUser);
router.get('/check-block', authMiddleware, supportController.checkBlockStatus);

// Visitor History
router.get('/visitors', authMiddleware, supportController.getVisitorHistory);
router.post('/visitors/record', supportController.recordVisitor);

module.exports = router;