// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/sockets/authSocket.js
// ARVIND PARTY — Authentication Real-time Socket Events
// Handles: Force logout, suspicious login alerts, session notifications
// ═══════════════════════════════════════════════════════════════════════════

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Auth Socket connected: ${socket.id}`);

    // ─────────────────────────────────────────────────────────────────────
    // USER AUTHENTICATES SOCKET WITH JWT
    // Client sends: { token: "jwt_token" }
    // ─────────────────────────────────────────────────────────────────────
    socket.on('auth:login', async (data, callback) => {
      try {
        const { token, deviceId } = data;
        if (!token) {
          return callback({ success: false, message: 'Token required' });
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;

        if (!userId) {
          return callback({ success: false, message: 'Invalid token payload' });
        }

        socket.join(`user:${userId}`);
        socket.data.userId = userId;
        socket.data.deviceId = deviceId || null;

        const DeviceSession = require('../models/DeviceSession');
        await DeviceSession.findOneAndUpdate(
          { sessionToken: token, userId, isActive: true },
          { socketId: socket.id, lastActivityAt: new Date() }
        );

        callback({ success: true, message: 'Socket authenticated', userId });
      } catch (error) {
        console.error('❌ Socket auth error:', error);
        callback({ success: false, message: 'Authentication failed' });
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // DISCONNECT HANDLER
    // ─────────────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      try {
        const userId = socket.data.userId;
        const deviceId = socket.data.deviceId;

        if (userId && deviceId) {
          const DeviceSession = require('../models/DeviceSession');
          await DeviceSession.findOneAndUpdate(
            { userId, deviceId, isActive: true },
            { socketId: null, lastActivityAt: new Date() }
          );
        }
      } catch (error) {
        console.error('❌ Socket disconnect error:', error);
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // HEARTBEAT / ACTIVITY UPDATE
    // Client sends: { token, roomId, roomName }
    // ─────────────────────────────────────────────────────────────────────
    socket.on('auth:heartbeat', async (data, callback) => {
      try {
        const { token, roomId, roomName } = data;
        if (!token) return callback({ success: false });

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;

        if (!userId) return callback({ success: false });

        const DeviceSession = require('../models/DeviceSession');
        const update = { lastActivityAt: new Date() };
        if (roomId) update.currentRoomId = roomId;
        if (roomName) update.currentRoomName = roomName;

        await DeviceSession.findOneAndUpdate(
          { sessionToken: token, userId, isActive: true },
          update
        );

        callback({ success: true });
      } catch (error) {
        callback({ success: false });
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // FORCE LOGOUT RECEIVED (from another device's logout)
    // Client receives: force_logout event
    // ─────────────────────────────────────────────────────────────────────
    socket.on('auth:force-logout-ack', async (data) => {
      try {
        const { sessionId } = data;
        console.log(`🔌 Force logout ack from ${socket.id} for session ${sessionId}`);
      } catch (error) {
        console.error('❌ Force logout ack error:', error);
      }
    });

    console.log('✅ Auth socket events registered');
  });
};