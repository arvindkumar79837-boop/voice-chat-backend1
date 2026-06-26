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

const initializeSockets = (io) => {
  // Create /youtube namespace
  const youtubeNamespace = io.of('/youtube');
  
  youtubeNamespace.on('connection', (socket) => {
    console.log('YouTube namespace client connected:', socket.id);
    youtubeSocket(io, socket);
  });

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
    eventSocket.initialize(io, socket);
    rewardSocket.initRewardSocket(io, socket);
    powerMatrixSocket(io, socket);
    matchmakingSocket(io, socket);

    socket.on('disconnect', () => {
      console.log('A user disconnected');
    });
  });
};

module.exports = { initializeSockets };