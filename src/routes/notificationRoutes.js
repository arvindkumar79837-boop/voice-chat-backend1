const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middlewares/auth.middleware');

// All notification routes require authentication
router.use(authMiddleware);

router.get('/', asyncHandler(notificationController.getNotifications));
router.put('/:notificationId/read', asyncHandler(notificationController.markAsRead));
router.put('/mark-all-read', asyncHandler(notificationController.markAllAsRead));
router.delete('/:notificationId', asyncHandler(notificationController.deleteNotification));

module.exports = router;