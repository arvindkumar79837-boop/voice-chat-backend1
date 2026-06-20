const Room = require('../models/Room');

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    // User attempts to claim a mic seat
    socket.on('claim_seat', async (data) => {
      try {
        const { roomId, userId, userName, userAvatar, seatIndex } = data;
        
        // Construct the new seat payload
        const updatedSeat = {
          seatIndex,
          userId,
          userName,
          userAvatar,
          isMuted: false,
          isLocked: false
        };

        // Validate room exists
        const room = await Room.findById(roomId);
        if (!room) {
          return socket.emit('seat_error', { message: 'Room not found.' });
        }

        // Remove user from any existing seat first to prevent duplicate seating
        await Room.updateOne(
          { _id: roomId },
          { $pull: { seats: { userId: userId } } }
        );
        
        // Update MongoDB to officially reserve this seat for the user
        await Room.updateOne(
          { _id: roomId },
          { $push: { seats: updatedSeat } }
        );

        // Broadcast the newly taken seat to everyone in the room!
        io.to(roomId).emit('seat_updated', updatedSeat);
        
      } catch (error) {
        console.error('Claim Seat Error:', error);
        socket.emit('seat_error', { message: 'Failed to claim the seat.' });
      }
    });

  });
};