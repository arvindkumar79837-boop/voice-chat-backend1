const Logger = require('../utils/logger');
const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { generateLiveKitToken } = require('../services/livekitService');
const { authMiddleware } = require('../middlewares/auth.middleware');

// LiveKit token routes require authentication to prevent identity spoofing
router.use(authMiddleware);

router.get('/:roomId/livekit/token', asyncHandler(async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.id || req.user?.userId || req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authenticated user required' });
    }

    const userName = req.query.userName || req.user?.name || 'User';
    const result = await generateLiveKitToken(roomId, userId, userName);

    if (!result) {
      return res.status(500).json({ success: false, message: 'Failed to generate LiveKit token. Check LiveKit credentials.' });
    }

    res.json({
      success: true,
      token: result.token,
      liveKitRoom: result.liveKitRoom,
      liveKitWsUrl: result.liveKitWsUrl
    });
  } catch (error) {
    Logger.error('LiveKit token error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate LiveKit token' });
  }
}));

router.post('/token', asyncHandler(async (req, res) => {
  try {
    const { roomId, userName } = req.body;
    const userId = req.user?.id || req.user?.userId || req.user?.uid;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'roomId is required' });
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authenticated user required' });
    }

    const result = await generateLiveKitToken(roomId, userId, userName || req.user?.name || 'User');

    if (!result) {
      return res.status(500).json({ success: false, message: 'Failed to generate LiveKit token. Check LiveKit credentials.' });
    }

    res.json({
      success: true,
      token: result.token,
      liveKitRoom: result.liveKitRoom,
      liveKitWsUrl: result.liveKitWsUrl
    });
  } catch (error) {
    Logger.error('LiveKit token error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate LiveKit token' });
  }
}));

module.exports = router;
