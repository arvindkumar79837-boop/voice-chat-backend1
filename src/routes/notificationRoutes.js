const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middlewares/auth.middleware');

const notificationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 60,
  message: { success: false, message: 'Too many notification requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// All notification routes require authentication
router.use(authMiddleware);

router.get('/', notificationRateLimit, asyncHandler(notificationController.getNotifications));
router.put('/:notificationId/read', asyncHandler(notificationController.markAsRead));
router.put('/mark-all-read', asyncHandler(notificationController.markAllAsRead));
router.delete('/:notificationId', asyncHandler(notificationController.deleteNotification));

module.exports = router;