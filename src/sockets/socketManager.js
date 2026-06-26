let io = null;

/**
 * Initializes the socket.io server instance.
 * @param {object} server - The HTTP server instance.
 */
const initSocketIo = (server) => {
  if (io) {
    return io;
  }
  
  // TO-DO: Add configuration for CORS
  io = require('socket.io')(server, {
    cors: {
      origin: "*", // Adjust for production
      methods: ["GET", "POST"]
    }
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
