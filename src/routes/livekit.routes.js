const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { generateLiveKitToken } = require('../services/livekitService');

router.get('/:roomId/livekit/token', asyncHandler(async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, userName } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const result = await generateLiveKitToken(roomId, userId, userName || 'User');

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
    console.error('LiveKit token error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate LiveKit token' });
  }
}));

router.post('/token', asyncHandler(async (req, res) => {
  try {
    const { roomId, userId, userName } = req.body;

    if (!roomId || !userId) {
      return res.status(400).json({ success: false, message: 'roomId and userId are required' });
    }

    const result = await generateLiveKitToken(roomId, userId, userName || 'User');

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
    console.error('LiveKit token error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate LiveKit token' });
  }
}));

module.exports = router;
