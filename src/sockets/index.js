const jwt = require('jsonwebtoken');
const authSocket = require('./authSocket');
const roomSocket = require('./roomSocket');
const chatSocket = require('./chatSocket');
const seatSocket = require('./seatSocket');
const giftSocket = require('./giftSocket');
const pkBattleSocket = require('./pkBattleSocket');
const familySocket = require('./familySocket');
const agencySocket = require('./agencySocket');
const analyticsSocket = require('./analytics.socket');
const gameSocket = require('../config/sockets/gameSocket');
const eventSocket = require('./eventSocket');
const rewardSocket = require('./rewardSocket');
const powerMatrixSocket = require('./powerMatrixSocket');
const matchmakingSocket = require('./matchmakingSocket');
const youtubeSocket = require('./youtubeSocket');

// Shared JWT auth middleware for socket namespaces
const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = decoded.userId || decoded.id || decoded.uid;
    socket.data.userRole = decoded.role;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
};

const initializeSockets = (io) => {
  // ─── /events namespace — JWT auth required ──────────────────────
  const eventsNamespace = io.of('/events');
  eventsNamespace.use(socketAuthMiddleware);
  eventsNamespace.on('connection', (socket) => {
    eventSocket.initialize(io, socket);
  });

  // ─── /room-features namespace — JWT auth required ──────────────
  const roomFeaturesNamespace = io.of('/room-features');
  roomFeaturesNamespace.use(socketAuthMiddleware);
  roomFeaturesNamespace.on('connection', (socket) => {
    const roomFeaturesSocket = require('./roomFeaturesSocket');
    roomFeaturesSocket(io, socket);
  });

  // ─── /youtube namespace — JWT auth required ────────────────────
  const youtubeNamespace = io.of('/youtube');
  youtubeNamespace.use(socketAuthMiddleware);
  youtubeNamespace.on('connection', (socket) => {
    console.log('YouTube namespace client connected:', socket.id);
    youtubeSocket(io, socket);
  });

  // ─── Default namespace — existing handlers ──────────────────────
  io.on('connection', (socket) => {
    console.log('A user connected');

    authSocket(io, socket);
    roomSocket(io, socket);
    chatSocket(io, socket);
    seatSocket(io, socket);
    giftSocket(io, socket);
    pkBattleSocket(io, socket);
    familySocket(io, socket);
    agencySocket(io, socket);
    analyticsSocket(io, socket);
    gameSocket(io, socket);
    rewardSocket.initRewardSocket(io, socket);
    powerMatrixSocket(io, socket);
    matchmakingSocket(io, socket);

    socket.on('disconnect', () => {
      console.log('A user disconnected');
    });
  });
};

module.exports = { initializeSockets };