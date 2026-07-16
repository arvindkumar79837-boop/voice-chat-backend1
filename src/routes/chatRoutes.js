const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const chatController = require('../controllers/chatController');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Route to get message history between two users — requires authentication
router.get('/history/:userId/:targetId', authMiddleware, asyncHandler(chatController.getChatHistory));

module.exports = router;