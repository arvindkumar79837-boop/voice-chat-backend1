const Room = require('../models/Room');

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    // ─── Advanced Seat Management ──────────────────────────────────
    
    // User attempts to claim a mic seat
    socket.on('claim_seat', async (data) => {
      try {
        const { roomId, userId, userName, userAvatar, seatIndex } = data;

        const room = await Room.findOne({ roomId });
        if (!room) {
          return socket.emit('seat_error', { message: 'Room not found.' });
        }

        if (seatIndex < 0 || seatIndex >= room.seats.length) {
          return socket.emit('seat_error', { message: 'Invalid seat index.' });
        }

        // Check if seat is locked
        if (room.seats[seatIndex].isLocked) {
          return socket.emit('seat_error', { message: 'This seat is locked. Ask the host to unlock it.' });
        }

        // Check if seat is already occupied
        if (room.seats[seatIndex].userId) {
          return socket.emit('seat_error', { message: 'This seat is already occupied.' });
        }

        // Remove user from any existing seat first
        const existingSeatIdx = room.seats.findIndex(s => s.userId && s.userId.toString() === userId);
        if (existingSeatIdx !== -1) {
          room.seats[existingSeatIdx].userId = null;
          room.seats[existingSeatIdx].userName = '';
          room.seats[existingSeatIdx].userAvatar = '';
          room.seats[existingSeatIdx].isMuted = false;
          room.seats[existingSeatIdx].isHost = false;
          room.seats[existingSeatIdx].joinedAt = null;

          // Emit vacated event for the old seat with animated effect
          io.to(roomId).emit('seat_vacated', { seatIndex: existingSeatIdx });
          io.to(roomId).emit('seat_animation', { 
            seatIndex: existingSeatIdx, 
            effect: 'vacate_fade_out',
            userId: userId
          });
        }

        // Claim the new seat
        const isHost = userId === room.ownerId.toString();
        room.seats[seatIndex].userId = userId;
        room.seats[seatIndex].userName = userName || 'User';
        room.seats[seatIndex].userAvatar = userAvatar || '';
        room.seats[seatIndex].isMuted = false;
        room.seats[seatIndex].isHost = isHost;
        room.seats[seatIndex].joinedAt = new Date();

        await room.save();

        // Broadcast seat claimed with animated ring effects for VIP seats
        io.to(roomId).emit('seat_updated', room.seats[seatIndex]);
        io.to(roomId).emit('seat_claimed', {
          seatIndex,
          userId,
          userName: room.seats[seatIndex].userName,
          userAvatar: room.seats[seatIndex].userAvatar,
          isHost,
          effect: isHost ? 'vip_seat_ring_gold' : 'seat_ring_blue'
        });

        // Sound wave animation for active speaking seat
        io.to(roomId).emit('seat_animation', {
          seatIndex,
          effect: 'sound_wave_active',
          userId: userId
        });

      } catch (error) {
        console.error('Claim Seat Error:', error);
        socket.emit('seat_error', { message: 'Failed to claim the seat.' });
      }
    });

    // ─── User leaves a seat ────────────────────────────────────────
    socket.on('leave_seat', async ({ roomId, seatIndex, userId }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        if (seatIndex < 0 || seatIndex >= room.seats.length) return;

        // Verify the user owns this seat
        if (room.seats[seatIndex].userId && room.seats[seatIndex].userId.toString() !== userId) {
          return socket.emit('seat_error', { message: 'You can only leave your own seat.' });
        }

        room.seats[seatIndex].userId = null;
        room.seats[seatIndex].userName = '';
        room.seats[seatIndex].userAvatar = '';
        room.seats[seatIndex].isMuted = false;
        room.seats[seatIndex].isHost = false;
        room.seats[seatIndex].joinedAt = null;

        await room.save();

        io.to(roomId).emit('seat_vacated', { seatIndex, userId });
        io.to(roomId).emit('seat_animation', {
          seatIndex,
          effect: 'vacate_fade_out',
          userId: userId
        });
      } catch (error) {
        console.error('Leave Seat Error:', error);
        socket.emit('seat_error', { message: 'Failed to leave seat.' });
      }
    });

    // ─── Admin: Lock seat ─────────────────────────────────────────
    socket.on('lock_seat_action', async ({ roomId, seatIndex, adminId }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        const isAuthorized = room.ownerId.toString() === adminId?.toString() ||
          room.coHosts.some(id => id.toString() === adminId?.toString()) ||
          room.admins.some(id => id.toString() === adminId?.toString());

        if (!isAuthorized || seatIndex < 0 || seatIndex >= room.seats.length) return;

        room.seats[seatIndex].isLocked = true;
        await room.save();

        // If someone is on the seat, trigger auto-removal with kick effect
        if (room.seats[seatIndex].userId) {
          io.to(roomId).emit('seat_locked_with_kick', {
            seatIndex,
            targetUserId: room.seats[seatIndex].userId.toString(),
            effect: 'kick_red_flash'
          });
          room.seats[seatIndex].userId = null;
          room.seats[seatIndex].userName = '';
          room.seats[seatIndex].userAvatar = '';
          room.seats[seatIndex].isHost = false;
          room.seats[seatIndex].joinedAt = null;
          await room.save();
        }

        io.to(roomId).emit('seat_lock_state_changed', { seatIndex, isLocked: true });
        io.to(roomId).emit('seat_animation', { seatIndex, effect: 'lock_icon_appear' });
      } catch (error) {
        console.error('Lock Seat Action Error:', error);
      }
    });

    // ─── Admin: Unlock seat ───────────────────────────────────────
    socket.on('unlock_seat_action', async ({ roomId, seatIndex, adminId }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        const isAuthorized = room.ownerId.toString() === adminId?.toString() ||
          room.coHosts.some(id => id.toString() === adminId?.toString()) ||
          room.admins.some(id => id.toString() === adminId?.toString());

        if (!isAuthorized || seatIndex < 0 || seatIndex >= room.seats.length) return;

        room.seats[seatIndex].isLocked = false;
        await room.save();

        io.to(roomId).emit('seat_lock_state_changed', { seatIndex, isLocked: false });
        io.to(roomId).emit('seat_animation', { seatIndex, effect: 'unlock_sparkle' });
      } catch (error) {
        console.error('Unlock Seat Action Error:', error);
      }
    });

    // ─── Admin: Mute seat (microphone off) ────────────────────────
    socket.on('mute_seat_action', async ({ roomId, seatIndex, adminId }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        const isAuthorized = room.ownerId.toString() === adminId?.toString() ||
          room.coHosts.some(id => id.toString() === adminId?.toString()) ||
          room.admins.some(id => id.toString() === adminId?.toString());

        if (!isAuthorized || seatIndex < 0 || seatIndex >= room.seats.length) return;

        room.seats[seatIndex].isMuted = true;
        await room.save();

        io.to(roomId).emit('seat_muted', { seatIndex, userId: room.seats[seatIndex].userId });
        io.to(roomId).emit('seat_animation', { seatIndex, effect: 'mic_off_red_overlay' });
        io.to(roomId).emit('user_admin_muted', { targetUserId: room.seats[seatIndex].userId });
      } catch (error) {
        console.error('Mute Seat Action Error:', error);
      }
    });

    // ─── Admin: Unmute seat ───────────────────────────────────────
    socket.on('unmute_seat_action', async ({ roomId, seatIndex, adminId }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        const isAuthorized = room.ownerId.toString() === adminId?.toString() ||
          room.coHosts.some(id => id.toString() === adminId?.toString()) ||
          room.admins.some(id => id.toString() === adminId?.toString());

        if (!isAuthorized || seatIndex < 0 || seatIndex >= room.seats.length) return;

        room.seats[seatIndex].isMuted = false;
        await room.save();

        io.to(roomId).emit('seat_unmuted', { seatIndex, userId: room.seats[seatIndex].userId });
        io.to(roomId).emit('seat_animation', { seatIndex, effect: 'mic_on_green_pulse' });
        io.to(roomId).emit('user_admin_unmuted', { targetUserId: room.seats[seatIndex].userId });
      } catch (error) {
        console.error('Unmute Seat Action Error:', error);
      }
    });

    // ─── User sound wave animation trigger ────────────────────────
    socket.on('user_start_speaking', ({ roomId, seatIndex, userId }) => {
      io.to(roomId).emit('seat_animation', {
        seatIndex,
        effect: 'sound_wave_active',
        userId: userId
      });
    });

    socket.on('user_stop_speaking', ({ roomId, seatIndex, userId }) => {
      io.to(roomId).emit('seat_animation', {
        seatIndex,
        effect: 'sound_wave_idle',
        userId: userId
      });
    });

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
  });
};
