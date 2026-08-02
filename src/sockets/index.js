const Logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const authSocket = require('./authSocket');
const roomSocket = require('./roomSocket');
const chatSocket = require('./chatSocket');
const seatSocket = require('./seatSocket');
const giftSocket = require('./giftSocket');
const pkBattleSocket = require('./pkBattleSocket');
const { setupFamilySocketHandlers } = require('./familySocket');
const agencySocket = require('./agencySocket');
const analyticsSocket = require('./analytics.socket');
const gameSocket = require('../config/sockets/gameSocket');
const eventSocket = require('./eventSocket');
const rewardSocket = require('./rewardSocket');
const powerMatrixSocket = require('./powerMatrixSocket');
const matchmakingSocket = require('./matchmakingSocket');
const youtubeSocket = require('./youtubeSocket');

// Shared JWT auth middleware for socket namespaces
const User = require('../models/User');
const Room = require('../models/Room');
const socketAuthMiddleware = async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token || socket.handshake.headers.authorization?.split(' ')[1];
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId || decoded.uid;

    // ── Banned User Check (P1-5) ──────────────────────────────────────
    const user = await User.findById(userId).select('_id name isBanned isActive').lean();
    if (!user) return next(new Error('User not found'));
    if (user.isBanned) return next(new Error('Account has been banned'));
    if (!user.isActive) return next(new Error('Account is inactive'));

    socket.data.userId = userId;
    socket.data.userRole = decoded.role;
    socket.data.userName = user.name;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
};

const initializeSockets = (io) => {
  try {
    // ─── GLOBAL SOCKET AUTH MIDDLEWARE ────────────────────────────────
    // Apply JWT auth to ALL connections on the default namespace.
    // This prevents unauthenticated clients from firing any socket events
    // (gifts, wallet, rooms, etc.) — a critical security requirement.
    io.use(socketAuthMiddleware);

    // ─── /events namespace (self-contained in eventSocket.js, JWT inside) ──
    eventSocket.initialize(io);

    // ─── /room-features namespace (self-contained in roomFeaturesSocket.js, JWT inside) ──
    require('./roomFeaturesSocket').setupRoomFeaturesSocket(io);

    // ─── /youtube namespace — JWT auth required ────────────────────
    const youtubeNamespace = io.of('/youtube');
    youtubeNamespace.use(socketAuthMiddleware);
    youtubeNamespace.on('connection', (socket) => {
      Logger.info('YouTube namespace client connected:', socket.id);
      youtubeSocket(io, socket);
    });

    // ─── Default namespace — existing handlers ──────────────────────
    io.on('connection', (socket) => {
      Logger.info('A user connected');

      authSocket(io, socket);
      roomSocket(io, socket);
      chatSocket(io, socket);
      seatSocket(io, socket);
      giftSocket(io, socket);
      pkBattleSocket(io, socket);
      setupFamilySocketHandlers(io, socket);
      agencySocket(io, socket);
      analyticsSocket(io, socket);
      gameSocket(io, socket);
      rewardSocket.initRewardSocket(io, socket);
      powerMatrixSocket(io, socket);
      matchmakingSocket(io, socket);

      // ─── Enhanced Disconnect Cleanup ──────────────────────────────
      // Prevent memory leaks and ensure proper cleanup of:
      // - Room subscriptions
      // - Redis presence data
      // - Active user counters
      socket.on('disconnect', async (reason) => {
        Logger.info(`User disconnected: ${socket.data.userId || 'unknown'} (reason: ${reason})`);

        try {
          const userId = socket.data.userId;
          const roomsToLeave = [];

          // Safely collect rooms before leaving
          if (socket.rooms) {
            socket.rooms.forEach(room => {
              if (room !== socket.id) {
                roomsToLeave.push(room);
              }
            });
          }

          // Notify rooms and decrement counters
          if (userId && roomsToLeave.length > 0) {
            for (const roomId of roomsToLeave) {
              // Emit user left event
              io.to(roomId).emit('room:user_left', {
                userId,
                reason,
                timestamp: new Date()
              });

              // Decrement room active users counter (prevent negative)
              await Room.findOneAndUpdate(
                { roomId, activeUsers: { $gt: 0 } },
                { $inc: { activeUsers: -1 } }
              ).catch(err => Logger.error('Error decrementing activeUsers:', err));

              // Leave the room
              socket.leave(roomId);
            }

            // Clear Redis presence
            const { getRedisClient } = require('../config/redis');
            const redis = getRedisClient();
            if (redis) {
              await redis.del(`presence:${userId}`).catch(() => {});
              await redis.srem('online_users', userId).catch(() => {});
            }
          }
        } catch (error) {
          Logger.error('Disconnect cleanup error:', error);
        }
      });
    });
  } catch (err) {
    Logger.error('❌ Socket initialization failed:', err);
  }
};

module.exports = { initializeSockets };