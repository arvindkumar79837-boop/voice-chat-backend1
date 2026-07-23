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

      socket.on('disconnect', (reason) => {
        Logger.info(`User disconnected: ${socket.data.userId || 'unknown'} (reason: ${reason})`);

        // Cleanup: leave all rooms this socket was in
        if (socket.rooms && socket.rooms.size > 0) {
          for (const room of socket.rooms) {
            if (room !== socket.id) {
              socket.leave(room);
            }
          }
        }

        // Cleanup: notify room sockets of user departure
        if (socket.data.userId) {
          io.emit('room:user_left', { userId: socket.data.userId, reason });
        }
      });
    });
  } catch (err) {
    Logger.error('❌ Socket initialization failed:', err);
  }
};

module.exports = { initializeSockets };