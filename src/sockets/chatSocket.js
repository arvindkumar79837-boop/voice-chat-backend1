const RoomMessage = require('../models/RoomMessage');

module.exports = (io, socket) => {
  // Send a text message in the room
  socket.on('send_room_message', async (data) => {
    try {
      const senderId = socket.data.userId;
      if (!senderId) {
        return socket.emit('error', { message: 'Authentication required.' });
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
      console.error('Chat message error:', error);
    }
  });

  // Send an animated emoji or quick reaction
  socket.on('send_reaction', (data) => {
    try {
      io.to(data.roomId).emit('receive_reaction', data);
    } catch (error) {
      console.error('[send_reaction] error:', error.message);
      socket.emit('error', { message: 'Something went wrong. Please try again.' });
    }
  });

  // Typing indicator for Flutter client
  socket.on('chat:typing', (data) => {
    try {
      const { roomId } = data;
      if (roomId) {
        socket.to(roomId).emit('chat:typing', data);
      }
    } catch (error) {
      console.error('[chat:typing] error:', error.message);
      socket.emit('error', { message: 'Something went wrong. Please try again.' });
    }
  });

  // Private chat message forwarding
  socket.on('chat:private', (data) => {
    try {
      const { receiverId } = data;
      if (receiverId) {
        io.to(`user:${receiverId}`).emit('chat:private', data);
      }
    } catch (error) {
      console.error('[chat:private] error:', error.message);
      socket.emit('error', { message: 'Something went wrong. Please try again.' });
    }
  });
};