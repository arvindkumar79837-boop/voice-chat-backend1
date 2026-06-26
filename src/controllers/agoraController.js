// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/agoraController.js
// ARVIND PARTY - AGORA REAL-TIME COMMUNICATION CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const { Agora } = require('../services/agoraService');
const Room = require('../models/Room');
const RoomSeat = require('../models/RoomSeat');
const User = require('../models/User');

const router = express.Router();

// ═══════ AGORA TOKEN GENERATION ══════════════════════════════════════════

/**
 * @route POST /api/room/:roomId/agora/token
 * @desc Generate Agora RTC token for a user to join a room
 * @access Private
 * @body { role?: 'host' | 'audience' | 'moderator' }
 * @returns { token, uid, expireTime, appId }
 */
router.post('/room/:roomId/agora/token', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { role = 'audience', expireTime = 3600 } = req.body;
    const userId = req.user?.id || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate unique UID for this user in this room
    const uid = generateUniqueUid(userId, roomId);

    // Get Agora app ID from config
    const appId = process.env.AGORA_APP_ID;
    if (!appId) {
      return res.status(500).json({
        success: false,
        message: 'Agora not configured on server',
      });
    }

    // Generate token using Agora service
    const token = Agora.generateToken({
      appId,
      appCertificate: process.env.AGORA_APP_CERTIFICATE,
      channelName: `room_${roomId}`,
      uid,
      role: role === 'host' ? 'publisher' : 'audience',
      expireTime: parseInt(expireTime, 10),
    });

    // Log token generation
    console.log(`[Agora] Token generated for user ${userId} in room ${roomId}, uid: ${uid}`);

    res.json({
      success: true,
      data: {
        token,
        uid,
        expireTime: parseInt(expireTime, 10),
        appId,
        channelName: `room_${roomId}`,
        role,
      },
    });
  } catch (error) {
    console.error('[Agora] Token generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Agora token',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/room/:roomId/members
 * @desc Get all members in a room with their seat and media status
 * @access Private
 * @returns { members: [{ userId, seat, status, audio, video }] }
 */
router.get('/room/:roomId/members', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Get all active seats in the room
    const seats = await RoomSeat.find({ roomId, isActive: true }).populate('userId', 'name avatar');

    const members = seats.map((seat) => ({
      userId: seat.userId?._id || seat.userId,
      userName: seat.userId?.name || 'Unknown',
      userAvatar: seat.userId?.avatar || null,
      seat: seat.seatNumber,
      status: seat.status, // 'joined', 'muted', 'left'
      audio: seat.isAudioEnabled,
      video: seat.isVideoEnabled,
      isHost: seat.isHost,
      isCoHost: seat.isCoHost,
      joinedAt: seat.joinedAt,
    }));

    res.json({
      success: true,
      data: {
        members,
        total: members.length,
      },
    });
  } catch (error) {
    console.error('[Agora] Get members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room members',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/room/:roomId/seat/occupy
 * @desc User occupies a seat in the room
 * @access Private
 * @body { seatNumber: number }
 * @returns { seat: { seatNumber, userId, status } }
 */
router.post('/room/:roomId/seat/occupy', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { seatNumber } = req.body;
    const userId = req.user?.id || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate room exists and is active
    const room = await Room.findById(roomId);
    if (!room || room.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Room not found or not active',
      });
    }

    // Check if seat is already occupied
    const existingSeat = await RoomSeat.findOne({
      roomId,
      seatNumber,
      isActive: true,
    });

    if (existingSeat && existingSeat.userId.toString() !== userId) {
      return res.status(409).json({
        success: false,
        message: 'Seat already occupied',
        occupiedBy: existingSeat.userId,
      });
    }

    // Create or update seat
    const seat = await RoomSeat.findOneAndUpdate(
      { roomId, seatNumber, userId },
      {
        roomId,
        seatNumber,
        userId,
        status: 'joined',
        isAudioEnabled: true,
        isVideoEnabled: true,
        isHost: false,
        isCoHost: false,
        isActive: true,
        joinedAt: new Date(),
      },
      { upsert: true, new: true }
    ).populate('userId', 'name avatar');

    // Broadcast seat occupied event via Socket.IO
    if (req.io) {
      req.io.to(`room:${roomId}`).emit('seat:occupied', {
        roomId,
        seatNumber,
        userId,
        userName: seat.userId?.name || 'Unknown',
        userAvatar: seat.userId?.avatar,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      data: {
        seat: {
          seatNumber: seat.seatNumber,
          userId: seat.userId?._id,
          status: seat.status,
          isAudioEnabled: seat.isAudioEnabled,
          isVideoEnabled: seat.isVideoEnabled,
        },
      },
    });
  } catch (error) {
    console.error('[Agora] Occupy seat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to occupy seat',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/room/:roomId/seat/leave
 * @desc User leaves their seat
 * @access Private
 * @body { seatNumber: number }
 * @returns { success: boolean }
 */
router.post('/room/:roomId/seat/leave', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { seatNumber } = req.body;
    const userId = req.user?.id || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Find and deactivate the seat
    const seat = await RoomSeat.findOne({
      roomId,
      seatNumber,
      userId,
      isActive: true,
    });

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Active seat not found',
      });
    }

    seat.isActive = false;
    seat.leftAt = new Date();
    await seat.save();

    // Broadcast seat vacant event via Socket.IO
    if (req.io) {
      req.io.to(`room:${roomId}`).emit('seat:vacant', {
        roomId,
        seatNumber,
        userId,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: 'Seat released successfully',
    });
  } catch (error) {
    console.error('[Agora] Leave seat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave seat',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/room/:roomId/seat/update-media
 * @desc Update user's audio/video status
 * @access Private
 * @body { seatNumber, isAudioEnabled, isVideoEnabled }
 */
router.post('/room/:roomId/seat/update-media', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { seatNumber, isAudioEnabled, isVideoEnabled } = req.body;
    const userId = req.user?.id || req.userId;

    const seat = await RoomSeat.findOne({
      roomId,
      seatNumber,
      userId,
      isActive: true,
    });

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Active seat not found',
      });
    }

    seat.isAudioEnabled = isAudioEnabled;
    seat.isVideoEnabled = isVideoEnabled;
    await seat.save();

    // Broadcast media update
    if (req.io) {
      req.io.to(`room:${roomId}`).emit('seat:media-updated', {
        roomId,
        userId,
        seatNumber,
        isAudioEnabled,
        isVideoEnabled,
      });
    }

    res.json({
      success: true,
      data: {
        isAudioEnabled,
        isVideoEnabled,
      },
    });
  } catch (error) {
    console.error('[Agora] Update media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update media status',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/room/:roomId/host/mute
 * @desc Host mutes a user
 * @access Private (Host only)
 * @body { userId, seatNumber }
 */
router.post('/room/:roomId/host/mute', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, seatNumber } = req.body;
    const hostId = req.user?.id || req.userId;

    // Verify requester is host
    const hostSeat = await RoomSeat.findOne({
      roomId,
      userId: hostId,
      isActive: true,
      isHost: true,
    });

    if (!hostSeat) {
      return res.status(403).json({
        success: false,
        message: 'Only host can mute users',
      });
    }

    // Mute the target user
    const targetSeat = await RoomSeat.findOne({
      roomId,
      seatNumber,
      userId,
      isActive: true,
    });

    if (!targetSeat) {
      return res.status(404).json({
        success: false,
        message: 'User seat not found',
      });
    }

    targetSeat.status = 'muted';
    await targetSeat.save();

    // Broadcast mute event
    if (req.io) {
      req.io.to(`room:${roomId}`).emit('seat:muted', {
        roomId,
        userId,
        seatNumber,
        mutedBy: hostId,
      });
    }

    res.json({
      success: true,
      message: 'User muted',
    });
  } catch (error) {
    console.error('[Agora] Mute user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mute user',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/room/:roomId/host/kick
 * @desc Host kicks a user from the room
 * @access Private (Host only)
 * @body { userId, seatNumber }
 */
router.post('/room/:roomId/host/kick', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, seatNumber } = req.body;
    const hostId = req.user?.id || req.userId;

    // Verify requester is host
    const hostSeat = await RoomSeat.findOne({
      roomId,
      userId: hostId,
      isActive: true,
      isHost: true,
    });

    if (!hostSeat) {
      return res.status(403).json({
        success: false,
        message: 'Only host can kick users',
      });
    }

    // Remove the target user's seat
    const targetSeat = await RoomSeat.findOne({
      roomId,
      seatNumber,
      userId,
      isActive: true,
    });

    if (!targetSeat) {
      return res.status(404).json({
        success: false,
        message: 'User seat not found',
      });
    }

    targetSeat.isActive = false;
    targetSeat.leftAt = new Date();
    await targetSeat.save();

    // Broadcast kick event
    if (req.io) {
      req.io.to(`room:${roomId}`).emit('user:kicked', {
        roomId,
        userId,
        seatNumber,
        kickedBy: hostId,
      });

      // Also emit to the specific user
      req.io.to(`user:${userId}`).emit('kicked:from-room', {
        roomId,
        reason: 'You have been removed by the host',
      });
    }

    res.json({
      success: true,
      message: 'User kicked from room',
    });
  } catch (error) {
    console.error('[Agora] Kick user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to kick user',
      error: error.message,
    });
  }
});

// ═══════ UTILITY FUNCTIONS ══════════════════════════════════════════════

/**
 * Generate a unique UID based on userId and roomId
 */
function generateUniqueUid(userId, roomId) {
  const hash = require('crypto')
    .createHash('md5')
    .update(`${userId}_${roomId}`)
    .digest('hex');

  // Take first 8 characters and ensure it's a valid number
  const uid = parseInt(hash.substring(0, 8), 16);
  // Ensure UID is within Agora's valid range (0 to 4294967295)
  return Math.abs(uid % 4294967295);
}

module.exports = router;