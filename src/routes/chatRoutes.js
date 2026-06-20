const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/auth.middleware');

// Route to get message history between two users — requires authentication
router.get('/history/:userId/:targetId', authMiddleware, chatController.getChatHistory);

module.exports = router;