const Room = require('../models/Room');

module.exports = (io, socket) => {

  // ─── Seat transfer (owner only) ───────────────────────────────
  socket.on('transfer_seat', async ({ roomId, fromSeatIndex, toUserId, toUserName, toUserAvatar, adminId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      const isAuthorized = room.ownerId.toString() === adminId?.toString() ||
        room.coHosts.some(id => id.toString() === adminId?.toString());

      if (!isAuthorized || fromSeatIndex < 0 || fromSeatIndex >= room.seats.length) return;

      room.seats[fromSeatIndex].userId = toUserId;
      room.seats[fromSeatIndex].userName = toUserName || '';
      room.seats[fromSeatIndex].userAvatar = toUserAvatar || '';
      room.seats[fromSeatIndex].joinedAt = new Date();

      await room.save();

      io.to(roomId).emit('seat_transferred', {
        seatIndex: fromSeatIndex,
        userId: toUserId,
        userName: toUserName,
        userAvatar: toUserAvatar
      });
      io.to(roomId).emit('seat_animation', {
        seatIndex: fromSeatIndex,
        effect: 'transfer_sparkle',
        userId: toUserId
      });
    } catch (error) {
      console.error('Transfer Seat Error:', error);
    }
  });

  // ─── Seat layout reorder (owner only) ─────────────────────────
  socket.on('reorder_seats', async ({ roomId, newOrder, adminId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room || room.ownerId.toString() !== adminId?.toString()) return;

      if (!Array.isArray(newOrder) || newOrder.length !== room.seats.length) return;

      const reordered = newOrder.map((oldIndex, newIndex) => {
        if (oldIndex >= 0 && oldIndex < room.seats.length) {
          const seat = { ...room.seats[oldIndex].toObject() };
          seat.seatIndex = newIndex;
          return seat;
        }
        return room.seats[newIndex];
      });

      room.seats = reordered;
      await room.save();

      io.to(roomId).emit('seats_reordered', { seats: room.seats });
    } catch (error) {
      console.error('Reorder Seats Error:', error);
    }
  });

  // ─── User sound wave animation trigger ────────────────────────
  socket.on('user_start_speaking', ({ roomId, seatIndex }) => {
    const userId = socket.data.userId;
    if (!userId) return;
    io.to(roomId).emit('seat_animation', {
      seatIndex,
      effect: 'sound_wave_active',
      userId
    });
  });

  socket.on('user_stop_speaking', ({ roomId, seatIndex }) => {
    const userId = socket.data.userId;
    if (!userId) return;
    io.to(roomId).emit('seat_animation', {
      seatIndex,
      effect: 'sound_wave_idle',
      userId
    });
  });
};
