const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Route to get message history between two users
router.get('/history/:userId/:targetId', chatController.getChatHistory);

module.exports = router;