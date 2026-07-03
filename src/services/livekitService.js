/**
 * Arvind Party - LiveKit Service
 * Generates LiveKit access tokens using the official livekit-server-sdk
 */
const { AccessToken, VideoGrant } = require('livekit-server-sdk');
const Room = require('../models/Room');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'wss://YOUR_LIVEKIT_DOMAIN';

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.warn('⚠️ LiveKit credentials missing. LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set.');
}

/**
 * Get or create LiveKit room name for a given app room
 */
const getLiveKitRoomName = async (roomId) => {
  const room = await Room.findOne({ roomId }).select('liveKitRoom');
  return room?.liveKitRoom || null;
};

/**
 * Generate a LiveKit access token for a user to join a room
 * @param {string} roomId - App room ID
 * @param {string|objectId} userId - User identity
 * @param {string} userName - Display name for the participant
 * @returns {object|null} { token, liveKitRoom, liveKitWsUrl }
 */
const generateLiveKitToken = async (roomId, userId, userName = 'User') => {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return null;
    }

    const liveKitRoom = await getLiveKitRoomName(roomId);
    if (!liveKitRoom) {
      console.warn(`LiveKit room not found for app room: ${roomId}`);
      return null;
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(userId),
      name: userName || 'User',
      ttl: '2h'
    });

    const grant = new VideoGrant();
    grant.roomJoin = true;
    grant.room = liveKitRoom;
    at.addGrant(grant);

    const token = await at.toJwt();

    return {
      token,
      liveKitRoom,
      liveKitWsUrl: LIVEKIT_WS_URL
    };
  } catch (error) {
    console.error('Generate LiveKit Token Error:', error);
    return null;
  }
};

module.exports = { generateLiveKitToken, getLiveKitRoomName };