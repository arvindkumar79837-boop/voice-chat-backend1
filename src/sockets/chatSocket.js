const Logger = require('../utils/logger');
const RoomMessage = require('../models/RoomMessage');
const { checkRateLimit, trackPresence } = require('../middlewares/socketSecurity.middleware');

module.exports = (io, socket) => {
  // Send a text message in the room
  socket.on('send_room_message', async (data) => {
    try {
      const senderId = socket.data.userId;
      if (!senderId) {
        return socket.emit('error', { message: 'Authentication required.' });
      }

      // Rate limit check
      const allowed = await checkRateLimit(senderId, 'chat');
      if (!allowed) {
        return socket.emit('error', { message: 'Please wait before sending another message.' });
      }

      // Track presence
      if (data.roomId) {
        await trackPresence(senderId, data.roomId);
      }

      // Save message to MongoDB for history/admin review
      const newMessage = await RoomMessage.create({
        roomId: data.roomId,
        senderId,
        message: data.message,
      });

      // Broadcast to everyone in the room
      io.to(data.roomId).emit('receive_room_message', {
        ...data,
        senderId,
        messageId: newMessage._id,
      });
    } catch (error) {
      Logger.error('Chat message error:', error);
    }
  });

  // Send an animated emoji or quick reaction
  socket.on('send_reaction', async (data) => {
    try {
      const senderId = socket.data.userId;
      if (!senderId) {
        return socket.emit('error', { message: 'Authentication required.' });
      }
      const { roomId, emoji } = data;
      
      // Rate limit check
      const allowed = await checkRateLimit(senderId, 'reaction');
      if (!allowed) {
        return socket.emit('error', { message: 'Please wait before sending another reaction.' });
      }

      if (!roomId || !emoji || typeof emoji !== 'string' || emoji.length > 10) {
        return socket.emit('error', { message: 'Invalid reaction data.' });
      }
      
      // Track presence
      if (roomId) {
        await trackPresence(senderId, roomId);
      }
      
      io.to(roomId).emit('receive_reaction', { roomId, emoji, senderId });
    } catch (error) {
      Logger.error('[send_reaction] error:', error.message);
      socket.emit('error', { message: 'Something went wrong. Please try again.' });
    }
  });

  // Typing indicator for Flutter client
  socket.on('chat:typing', async (data) => {
    try {
      const senderId = socket.data.userId;
      const { roomId } = data;
      
      // Rate limit check
      if (senderId) {
        const allowed = await checkRateLimit(senderId, 'typing');
        if (!allowed) {
          return socket.emit('error', { message: 'Please wait before sending typing indicator.' });
        }
      }
      
      if (roomId && senderId) {
        await trackPresence(senderId, roomId);
        socket.to(roomId).emit('chat:typing', data);
      }
    } catch (error) {
      Logger.error('[chat:typing] error:', error.message);
      socket.emit('error', { message: 'Something went wrong. Please try again.' });
    }
  });

  // Private chat message forwarding
  socket.on('chat:private', (data) => {
    try {
      const senderId = socket.data.userId;
      if (!senderId) {
        return socket.emit('error', { message: 'Authentication required.' });
      }
      const { receiverId } = data;
      if (receiverId) {
        io.to(`user:${receiverId}`).emit('chat:private', { ...data, senderId });
      }
    } catch (error) {
      Logger.error('[chat:private] error:', error.message);
      socket.emit('error', { message: 'Something went wrong. Please try again.' });
    }
  });
};