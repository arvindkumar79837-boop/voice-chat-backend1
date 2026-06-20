const RoomMessage = require('../models/RoomMessage');
const jwt = require('jsonwebtoken');
const logger = require('../middlewares/logger.middleware');

const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    logger.warn('Socket authentication failed', { error: error.message });
    next(new Error('Invalid authentication token'));
  }
};

module.exports = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    
    // Send a text message in the room
    socket.on('send_room_message', async (data) => {
      try {
        // Save message to MongoDB for history/admin review
        const newMessage = await RoomMessage.create({
          roomId: data.roomId,
          senderId: data.senderId,
          message: data.message
        });
        
        // Broadcast to everyone in the room
        io.to(data.roomId).emit('receive_room_message', { ...data, messageId: newMessage._id });
      } catch (error) {
        console.error('Chat message error:', error);
      }
    });

    // Send an animated emoji or quick reaction
    socket.on('send_reaction', (data) => {
      io.to(data.roomId).emit('receive_reaction', data);
    });
  });
};