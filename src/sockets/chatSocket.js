const RoomMessage = require('../models/RoomMessage');

module.exports = (io) => {
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