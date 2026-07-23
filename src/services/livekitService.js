const Logger = require('../utils/logger');
/**
 * Arvind Party - LiveKit Service
 * Generates LiveKit access tokens using the official livekit-server-sdk
 */
const { AccessToken, VideoGrant, RoomServiceClient } = require('livekit-server-sdk');
const Room = require('../models/Room');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'wss://YOUR_LIVEKIT_DOMAIN';

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  Logger.warn('⚠️ LiveKit credentials missing. LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set.');
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
      Logger.warn(`LiveKit room not found for app room: ${roomId}`);
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
    Logger.error('Generate LiveKit Token Error:', error);
    return null;
  }
};

/**
 * Delete a LiveKit room
 * @param {string} roomId - App room ID
 */
const deleteLiveKitRoom = async (roomId) => {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return;

    const liveKitRoom = await getLiveKitRoomName(roomId);
    if (!liveKitRoom) return;

    // The API URL should be the HTTP version of the WS URL
    const apiHost = LIVEKIT_WS_URL.replace('wss://', 'https://').replace('ws://', 'http://');
    const roomService = new RoomServiceClient(apiHost, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    await roomService.deleteRoom(liveKitRoom);
    Logger.info(`✅ LiveKit room ${liveKitRoom} deleted for app room ${roomId}`);
  } catch (error) {
    Logger.error(`❌ Error deleting LiveKit room for app room ${roomId}:`, error);
  }
};

module.exports = { generateLiveKitToken, getLiveKitRoomName, deleteLiveKitRoom };