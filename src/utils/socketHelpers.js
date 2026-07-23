// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/utils/socketHelpers.js
// ARVIND PARTY — Shared Socket Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

const RoomSeat = require('../models/RoomSeat');
const Room = require('../models/Room');

/**
 * Check if a user is currently an active participant in a room.
 * Checks both the RoomSeat collection and the room's embedded seats array.
 * @param {string} userId
 * @param {string} roomId
 * @returns {Promise<boolean>}
 */
const isUserInRoom = async (userId, roomId) => {
  try {
    // Primary: check RoomSeat collection
    const seat = await RoomSeat.findOne({
      roomId,
      userId,
      isActive: true,
    });
    if (seat) return true;

    // Fallback: check embedded seats in Room document
    const room = await Room.findOne({
      $or: [{ _id: roomId }, { roomId }],
      'seats.userId': userId,
    });
    return !!room;
  } catch {
    return false;
  }
};

/**
 * Emit an error event to a socket and optionally log it.
 * @param {Socket} socket
 * @param {string} message
 */
const emitError = (socket, message) => {
  socket.emit('error', { success: false, message });
};

module.exports = { isUserInRoom, emitError };
