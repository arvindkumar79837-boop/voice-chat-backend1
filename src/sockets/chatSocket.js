const RoomMessage = require('../models/RoomMessage');

module.exports = (io, socket) => {
  // Send a text message in the room
  socket.on('send_room_message', async (data) => {
    try {
      // Save message to MongoDB for history/admin review
      const newMessage = await RoomMessage.create({
        roomId: data.roomId,
        senderId: data.senderId,
        message: data.message,
      });

      // Broadcast to everyone in the room
      io.to(data.roomId).emit('receive_room_message', {
        ...data,
        messageId: newMessage._id,
      });
    } catch (error) {
      console.error('Chat message error:', error);
    }
  });

  // Send an animated emoji or quick reaction
  socket.on('send_reaction', (data) => {
    io.to(data.roomId).emit('receive_reaction', data);
  });

  // Typing indicator for Flutter client
  socket.on('chat:typing', (data) => {
    const { roomId } = data;
    if (roomId) {
      socket.to(roomId).emit('chat:typing', data);
    }
  });

  // Private chat message forwarding
  socket.on('chat:private', (data) => {
    const { receiverId } = data;
    if (receiverId) {
      io.to(`user:${receiverId}`).emit('chat:private', data);
    }
  });
};