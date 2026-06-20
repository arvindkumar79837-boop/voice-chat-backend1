const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/auth.middleware');

// All notification routes require authentication
router.use(authMiddleware);

router.get('/', notificationController.getNotifications);
router.put('/:notificationId/read', notificationController.markAsRead);
router.put('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;