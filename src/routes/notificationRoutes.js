const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

const notificationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 60,
  message: { success: false, message: 'Too many notification requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// All notification routes require authentication
router.use(authMiddleware);

router.get('/', validatePagination(), notificationRateLimit, asyncHandler(notificationController.getNotifications));
router.put('/:notificationId/read', validateObjectId('notificationId'), asyncHandler(notificationController.markAsRead));
router.put('/mark-all-read', asyncHandler(notificationController.markAllAsRead));
router.delete('/:notificationId', validateObjectId('notificationId'), asyncHandler(notificationController.deleteNotification));

module.exports = router;