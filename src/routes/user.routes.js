const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const User = require('../models/User');

router.post('/complete-profile', authMiddleware, asyncHandler(userController.updateProfile));
router.get('/center', authMiddleware, asyncHandler(userController.getUserCenter));
router.post('/equip-frame', authMiddleware, asyncHandler(userController.equipFrame));

router.get('/search', authMiddleware, asyncHandler(async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Query required' });

  const users = await User.find({
    username: { $regex: q, $options: 'i' }
  }).limit(parseInt(limit)).select('username avatar arvindId');

  res.json({ success: true, users });
}));

module.exports = router;
