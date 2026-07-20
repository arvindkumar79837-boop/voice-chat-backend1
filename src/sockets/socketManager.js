let io = null;

const allowedOrigins = (() => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }
  return [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
  ];
})();

/**
 * Initializes the socket.io server instance.
 * @param {object} server - The HTTP server instance.
 */
const initSocketIo = (server) => {
  if (io) {
    return io;
  }

  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling']
  });

  console.log('Socket.IO initialized');
  return io;
};

/**
 * Returns the socket.io server instance.
 * Throws an error if the instance is not initialized.
 * @returns {object}
 */
const getSocketIo = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized!');
  }
  return io;
};

module.exports = {
  initSocketIo,
  getSocketIo
};
