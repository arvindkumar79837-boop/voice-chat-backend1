const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const auth = require('../middlewares/auth.middleware');

// FAQ Routes
router.get('/faq', supportController.getFAQs);

// Support Tickets (User & Admin)
router.get('/tickets', auth, supportController.getTickets);
router.post('/ticket/create', auth, supportController.createTicket);
router.post('/ticket/reply', auth, supportController.replyToTicket);
router.post('/message', auth, supportController.sendMessage);

// Profile & Social
router.post('/profile/update', auth, supportController.updateProfile);
router.post('/profile/delete', auth, require('../controllers/auth.controller').deleteAccount);
router.post('/follow', auth, supportController.followUser);
router.get('/search', auth, supportController.searchUsers);

// Privacy & Block List
router.put('/privacy/toggle', auth, supportController.togglePrivacy);
router.get('/blocked', auth, supportController.getBlockedUsers);
router.post('/block', auth, supportController.addBlockedUser);
router.post('/unblock', auth, supportController.removeBlockedUser);
router.get('/check-block', auth, supportController.checkBlockStatus);

// Visitor History
router.get('/visitors', auth, supportController.getVisitorHistory);
router.post('/visitors/record', supportController.recordVisitor);

module.exports = router;