const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const chatController = require('../controllers/chatController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Route to get message history between two users — requires authentication
router.get('/history/:userId/:targetId', 
  validateObjectId('userId'), 
  validateObjectId('targetId'), 
  validatePagination(), 
  validateNumber('limit', { required: false, min: 1, max: 100 }),
  authMiddleware, 
  asyncHandler(chatController.getChatHistory)
);

// POST /messages - Send a new message (if it exists)
router.post('/messages', 
  authMiddleware,
  validateString('content', { required: true, maxLength: 500 }),
  validateAllowedFields(['content', 'roomId']),
  asyncHandler(chatController.sendMessage)
);

module.exports = router;