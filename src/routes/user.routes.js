const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const User = require('../models/User');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.post('/complete-profile', validateString('name', { required: false, minLength: 2, maxLength: 50 }), validateAllowedFields(['name']), authMiddleware, asyncHandler(userController.updateProfile));
router.get('/center', validatePagination(), authMiddleware, asyncHandler(userController.getUserCenter));
router.post('/equip-frame', authMiddleware, validateString('frameId', { required: true }), validateAllowedFields(['frameId']), asyncHandler(userController.equipFrame));

router.get('/search', authMiddleware, validateString('q', { required: true, minLength: 2, maxLength: 50 }), validateNumber('limit', { required: false, min: 1, max: 100 }), asyncHandler(async (req, res) => {
  const { q, limit = 20 } = req.query;

  const sanitized = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({
    username: { $regex: sanitized, $options: 'i' }
  }).limit(parseInt(limit, 10)).select('username avatar arvindId');

  res.json({ success: true, users });
}));

module.exports = router;
