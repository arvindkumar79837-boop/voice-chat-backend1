const Room = require('../models/Room');
const crypto = require('crypto');

module.exports = (io, socket) => {
  // ─── User joins a live voice room ────────────────────────────
  socket.on('join_room', async ({ roomId, userId, userProfile }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) {
        return socket.emit('room_error', { message: 'Room not found.' });
      }

      if (!room.isActive || room.status === 'banned') {
        return socket.emit('room_closed', {
          message: 'This room is no longer active.',
        });
      }

      // Check if user was previously kicked
      const isKicked =
        room.kickedUsers &&
        room.kickedUsers.some((id) => id.toString() === userId.toString());
      if (isKicked) {
        return socket.emit('user_kicked', {
          targetUserId: userId,
          reason: 'You were previously kicked from this room.',
        });
      }

      socket.join(roomId);

      // Increment active users in the MongoDB database
      await Room.findOneAndUpdate({ roomId }, { $inc: { activeUsers: 1 } });

      // Get updated seats matrix for the new user
      const updatedRoom = await Room.findOne({ roomId })
        .populate('ownerId', 'uid name username avatar')
        .lean();

      // Notify others in the room
      socket.to(roomId).emit('user_joined', {
        userId,
        userProfile,
        message: `${userProfile?.name || 'A user'} entered the room`,
        activeUsers: updatedRoom?.activeUsers || 0,
      });

      // Send current room state to the joining user
      socket.emit('room_state', {
        seats: updatedRoom?.seats || [],
        members: [],
        cosmetics: updatedRoom?.cosmetics || {},
        announcement: updatedRoom?.announcement || '',
        pinnedMessage: updatedRoom?.pinnedMessage || '',
        welcomeMessage: updatedRoom?.welcomeMessage || '',
        topic: updatedRoom?.topic || '',
        currentPkChallenge: updatedRoom?.currentPkChallenge || null,
        dailyTasks: updatedRoom?.dailyTasks || [],
        roomType: updatedRoom?.roomType || 'PUBLIC',
        isLive: updatedRoom?.isLive || false,
        liveKitRoom: updatedRoom?.liveKitRoom || '',
      });

      // Check if user was previously admin-muted
      const isMuted =
        room.mutedUsers &&
        room.mutedUsers.some((id) => id.toString() === userId.toString());
      if (isMuted) {
        socket.emit('user_admin_muted', { targetUserId: userId });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('room_error', { message: 'Failed to join room.' });
    }
  });

  // ─── User leaves a voice room ────────────────────────────────
  socket.on('leave_room', async ({ roomId, userId, userProfile }) => {
    socket.leave(roomId);

    // Decrement active users in the database
    const room = await Room.findOne({ roomId });
    if (room) {
      room.activeUsers = Math.max(0, room.activeUsers - 1);
      await room.save();

      // Auto-remove user from seat if they were on one
      const seatIdx = room.seats.findIndex(
        (s) => s.userId && s.userId.toString() === userId.toString()
      );
      if (seatIdx !== -1) {
        room.seats[seatIdx].userId = null;
        room.seats[seatIdx].userName = '';
        room.seats[seatIdx].userAvatar = '';
        room.seats[seatIdx].isMuted = false;
        room.seats[seatIdx].isHost = false;
        room.seats[seatIdx].joinedAt = null;
        await room.save();

        io.to(roomId).emit('seat_vacated', {
          seatIndex: seatIdx,
          activeUsers: room.activeUsers,
        });
      }
    }

    socket.to(roomId).emit('user_left', {
      userId,
      userProfile,
      message: `${userProfile?.name || 'A user'} left the room`,
      activeUsers: room?.activeUsers || 0,
    });
  });

  // ─── Mic status toggle (mute/unmute) ─────────────────────────
  socket.on('toggle_mic', async ({ roomId, userId, isMuted }) => {
    io.to(roomId).emit('mic_status_changed', { userId, isMuted });

    // Update seat mute state in DB
    await Room.findOneAndUpdate(
      { roomId, 'seats.userId': userId },
      { $set: { 'seats.$.isMuted': isMuted } }
    );
  });

  // ─── Claim a seat (with LiveKit audio sync) ──────────────────
  socket.on('claim_seat', async (data) => {
    try {
      const { roomId, userId, userName, userAvatar, seatIndex } = data;

      const room = await Room.findOne({ roomId });
      if (!room) {
        return socket.emit('seat_error', { message: 'Room not found.' });
      }

      if (seatIndex < 0 || seatIndex >= room.seats.length) {
        return socket.emit('seat_error', { message: 'Invalid seat.' });
      }

      // Check if seat is locked
      if (room.seats[seatIndex].isLocked) {
        return socket.emit('seat_error', { message: 'This seat is locked.' });
      }

      // Check if seat is already occupied
      if (room.seats[seatIndex].userId) {
        return socket.emit('seat_error', {
          message: 'This seat is already occupied.',
        });
      }

      // Remove user from any existing seat first
      const existingSeatIdx = room.seats.findIndex(
        (s) => s.userId && s.userId.toString() === userId.toString()
      );
      if (existingSeatIdx !== -1) {
        room.seats[existingSeatIdx].userId = null;
        room.seats[existingSeatIdx].userName = '';
        room.seats[existingSeatIdx].userAvatar = '';
        room.seats[existingSeatIdx].isMuted = false;
        room.seats[existingSeatIdx].isHost = false;
        room.seats[existingSeatIdx].joinedAt = null;
      }

      // Assign the seat
      const isHost = userId.toString() === room.ownerId.toString();
      room.seats[seatIndex].userId = userId;
      room.seats[seatIndex].userName = userName || 'User';
      room.seats[seatIndex].userAvatar = userAvatar || '';
      room.seats[seatIndex].isMuted = false;
      room.seats[seatIndex].isHost = isHost;
      room.seats[seatIndex].joinedAt = new Date();

      await room.save();

      // Broadcast seat claimed with animated effects data
      io.to(roomId).emit('seat_claimed', {
        seatIndex,
        userId,
        userName: room.seats[seatIndex].userName,
        userAvatar: room.seats[seatIndex].userAvatar,
        isHost,
        role: isHost ? 'owner' : 'broadcaster',
        isMuted: false,
        effect: 'seat_ring_animation',
      });

      // Notify if user was previously on another seat
      if (existingSeatIdx !== -1) {
        io.to(roomId).emit('seat_vacated', { seatIndex: existingSeatIdx });
      }
    } catch (error) {
      console.error('Claim Seat Error:', error);
      socket.emit('seat_error', { message: 'Failed to claim the seat.' });
    }
  });

  // ─── Leave a seat ────────────────────────────────────────────
  socket.on('leave_seat', async ({ roomId, seatIndex }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      if (seatIndex < 0 || seatIndex >= room.seats.length) return;

      room.seats[seatIndex].userId = null;
      room.seats[seatIndex].userName = '';
      room.seats[seatIndex].userAvatar = '';
      room.seats[seatIndex].isMuted = false;
      room.seats[seatIndex].isHost = false;
      room.seats[seatIndex].joinedAt = null;

      await room.save();

      io.to(roomId).emit('seat_vacated', { seatIndex });
    } catch (error) {
      console.error('Leave Seat Error:', error);
    }
  });

  // ─── Admin: Lock/unlock seat ─────────────────────────────────
  socket.on('lock_seat', async ({ roomId, seatIndex, adminId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      const isAuthorized =
        room.ownerId.toString() === adminId?.toString() ||
        room.coHosts.some((id) => id.toString() === adminId?.toString()) ||
        room.admins.some((id) => id.toString() === adminId?.toString());

      if (!isAuthorized || seatIndex < 0 || seatIndex >= room.seats.length)
        return;

      room.seats[seatIndex].isLocked = true;
      await room.save();

      // If someone is on the seat, kick them
      if (room.seats[seatIndex].userId) {
        io.to(roomId).emit('kicked_from_seat', {
          seatIndex,
          targetUserId: room.seats[seatIndex].userId.toString(),
        });
        room.seats[seatIndex].userId = null;
        room.seats[seatIndex].userName = '';
        room.seats[seatIndex].userAvatar = '';
        room.seats[seatIndex].isHost = false;
        room.seats[seatIndex].joinedAt = null;
        await room.save();
      }

      io.to(roomId).emit('seat_locked', { seatIndex });
    } catch (error) {
      console.error('Lock Seat Error:', error);
    }
  });

  socket.on('unlock_seat', async ({ roomId, seatIndex, adminId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      const isAuthorized =
        room.ownerId.toString() === adminId?.toString() ||
        room.coHosts.some((id) => id.toString() === adminId?.toString()) ||
        room.admins.some((id) => id.toString() === adminId?.toString());

      if (!isAuthorized || seatIndex < 0 || seatIndex >= room.seats.length)
        return;

      room.seats[seatIndex].isLocked = false;
      await room.save();

      io.to(roomId).emit('seat_unlocked', { seatIndex });
    } catch (error) {
      console.error('Unlock Seat Error:', error);
    }
  });

  // ─── Admin: Mute/unmute seat ─────────────────────────────────
  socket.on('admin_mute_seat', async ({ roomId, seatIndex, adminId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      const isAuthorized =
        room.ownerId.toString() === adminId?.toString() ||
        room.coHosts.some((id) => id.toString() === adminId?.toString()) ||
        room.admins.some((id) => id.toString() === adminId?.toString());

      if (!isAuthorized || seatIndex < 0 || seatIndex >= room.seats.length)
        return;

      room.seats[seatIndex].isMuted = true;
      await room.save();

      io.to(roomId).emit('seat_muted', {
        seatIndex,
        userId: room.seats[seatIndex].userId,
      });
    } catch (error) {
      console.error('Mute Seat Error:', error);
    }
  });

  socket.on('admin_unmute_seat', async ({ roomId, seatIndex, adminId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      const isAuthorized =
        room.ownerId.toString() === adminId?.toString() ||
        room.coHosts.some((id) => id.toString() === adminId?.toString()) ||
        room.admins.some((id) => id.toString() === adminId?.toString());

      if (!isAuthorized || seatIndex < 0 || seatIndex >= room.seats.length)
        return;

      room.seats[seatIndex].isMuted = false;
      await room.save();

      io.to(roomId).emit('seat_unmuted', {
        seatIndex,
        userId: room.seats[seatIndex].userId,
      });
    } catch (error) {
      console.error('Unmute Seat Error:', error);
    }
  });

  // ─── Admin: Kick user from seat ──────────────────────────────
  socket.on('kick_from_seat', async ({ roomId, seatIndex, adminId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      const isAuthorized =
        room.ownerId.toString() === adminId?.toString() ||
        room.coHosts.some((id) => id.toString() === adminId?.toString());

      if (!isAuthorized || seatIndex < 0 || seatIndex >= room.seats.length)
        return;

      const kickedUserId = room.seats[seatIndex].userId;

      room.seats[seatIndex].userId = null;
      room.seats[seatIndex].userName = '';
      room.seats[seatIndex].userAvatar = '';
      room.seats[seatIndex].isMuted = false;
      room.seats[seatIndex].isHost = false;
      room.seats[seatIndex].joinedAt = null;

      if (kickedUserId) {
        room.kickedUsers.push(kickedUserId);
      }

      await room.save();

      io.to(roomId).emit('kicked_from_seat', {
        seatIndex,
        targetUserId: kickedUserId,
      });
    } catch (error) {
      console.error('Kick From Seat Error:', error);
    }
  });

  // ─── Room Moderation: Kick User ──────────────────────────────
  socket.on('kick_user', async ({ roomId, targetUserId, adminId }) => {
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { $addToSet: { kickedUsers: targetUserId } }
      );

      // Also remove them from seat if seated
      const room = await Room.findOne({ roomId });
      if (room) {
        const seatIdx = room.seats.findIndex(
          (s) => s.userId && s.userId.toString() === targetUserId.toString()
        );
        if (seatIdx !== -1) {
          room.seats[seatIdx].userId = null;
          room.seats[seatIdx].userName = '';
          room.seats[seatIdx].userAvatar = '';
          room.seats[seatIdx].isMuted = false;
          room.seats[seatIdx].isHost = false;
          room.seats[seatIdx].joinedAt = null;
          await room.save();
          io.to(roomId).emit('seat_vacated', { seatIndex: seatIdx });
        }
      }

      io.to(roomId).emit('user_kicked', { targetUserId });
    } catch (error) {
      console.error('Error kicking user:', error);
    }
  });

  // ─── Room Moderation: Admin Mute User ────────────────────────
  socket.on('admin_mute_user', async ({ roomId, targetUserId, adminId }) => {
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { $addToSet: { mutedUsers: targetUserId } }
      );

      io.to(roomId).emit('user_admin_muted', { targetUserId });
    } catch (error) {
      console.error('Error muting user:', error);
    }
  });

  // ─── Room Moderation: Unkick User (Forgive) ──────────────────
  socket.on('unkick_user', async ({ roomId, targetUserId, adminId }) => {
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { $pull: { kickedUsers: targetUserId } }
      );
      io.to(roomId).emit('user_unkicked', { targetUserId });
    } catch (error) {
      console.error('Error unkicking user:', error);
    }
  });

  // ─── Room Moderation: Admin Unmute User ──────────────────────
  socket.on('admin_unmute_user', async ({ roomId, targetUserId, adminId }) => {
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { $pull: { mutedUsers: targetUserId } }
      );
      io.to(roomId).emit('user_admin_unmuted', { targetUserId });
    } catch (error) {
      console.error('Error unmuting user:', error);
    }
  });

  // ─── Room Announcement Update ────────────────────────────────
  socket.on('update_announcement', async ({ roomId, announcement }) => {
    try {
      await Room.findOneAndUpdate({ roomId }, { announcement });
      io.to(roomId).emit('announcement_updated', { announcement });
    } catch (error) {
      console.error('Update Announcement Error:', error);
    }
  });

  // ─── Room Pinned Message Update ──────────────────────────────
  socket.on('update_pinned_message', async ({ roomId, pinnedMessage }) => {
    try {
      await Room.findOneAndUpdate({ roomId }, { pinnedMessage });
      io.to(roomId).emit('pinned_message_updated', { pinnedMessage });
    } catch (error) {
      console.error('Update Pinned Message Error:', error);
    }
  });

  // ─── Room Welcome Message Update ─────────────────────────────
  socket.on('update_welcome_message', async ({ roomId, welcomeMessage }) => {
    try {
      await Room.findOneAndUpdate({ roomId }, { welcomeMessage });
      io.to(roomId).emit('welcome_message_updated', { welcomeMessage });
    } catch (error) {
      console.error('Update Welcome Message Error:', error);
    }
  });

  // ─── Room Topic Update ───────────────────────────────────────
  socket.on('update_topic', async ({ roomId, topic }) => {
    try {
      await Room.findOneAndUpdate({ roomId }, { topic });
      io.to(roomId).emit('topic_updated', { topic });
    } catch (error) {
      console.error('Update Topic Error:', error);
    }
  });

  // ─── Room Cosmetics Update ───────────────────────────────────
  socket.on(
    'update_room_background',
    async ({ roomId, backgroundUrl, backgroundName }) => {
      try {
        await Room.findOneAndUpdate(
          { roomId },
          {
            'cosmetics.backgroundUrl': backgroundUrl,
            'cosmetics.backgroundName': backgroundName,
          }
        );
        io.to(roomId).emit('room_background_updated', {
          backgroundUrl,
          backgroundName,
        });
      } catch (error) {
        console.error('Update Background Error:', error);
      }
    }
  );

  // ─── Update seat layout (owner only) ─────────────────────────
  socket.on('update_seat_layout', async ({ roomId, seatCount, adminId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room || room.ownerId.toString() !== adminId?.toString()) return;

      const newCount = Math.min(Math.max(parseInt(seatCount) || 8, 2), 32);

      // Adjust seats array
      if (newCount > room.seats.length) {
        for (let i = room.seats.length; i < newCount; i++) {
          room.seats.push({
            seatIndex: i,
            userId: null,
            userName: '',
            userAvatar: '',
            isMuted: false,
            isLocked: false,
            isHost: false,
            joinedAt: null,
          });
        }
      } else if (newCount < room.seats.length) {
        // Only remove empty seats
        while (room.seats.length > newCount) {
          const lastSeat = room.seats[room.seats.length - 1];
          if (lastSeat.userId) break; // Don't remove occupied seats
          room.seats.pop();
        }
      }

      room.seatCount = room.seats.length;
      await room.save();

      io.to(roomId).emit('seat_layout_changed', {
        seatCount: room.seats.length,
        seats: room.seats,
      });
    } catch (error) {
      console.error('Update Seat Layout Error:', error);
    }
  });

  // ─── Room PK: Update score ───────────────────────────────────
  socket.on('pk_update_score', async ({ roomId, score, userId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (
        !room ||
        !room.currentPkChallenge ||
        room.currentPkChallenge.status !== 'active'
      )
        return;

      if (room.currentPkChallenge.challengerRoomId === roomId) {
        room.currentPkChallenge.challengerScore += parseInt(score) || 1;
      } else if (room.currentPkChallenge.opponentRoomId === roomId) {
        room.currentPkChallenge.opponentScore += parseInt(score) || 1;
      }

      await room.save();

      // Notify both rooms
      const opponentRoomId =
        room.currentPkChallenge.challengerRoomId === roomId
          ? room.currentPkChallenge.opponentRoomId
          : room.currentPkChallenge.challengerRoomId;

      io.to(roomId).emit('pk_score_updated', room.currentPkChallenge);
      io.to(opponentRoomId).emit('pk_score_updated', room.currentPkChallenge);
    } catch (error) {
      console.error('PK Update Score Error:', error);
    }
  });

  // ─── Room Send Message ───────────────────────────────────────
  socket.on('send_room_message', async (data) => {
    const { roomId, senderId, senderName, message, isVip } = data;
    if (!roomId || !senderId || !message) return;

    const messageData = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId,
      senderName: senderName || 'Unknown',
      message: message.trim(),
      time: new Date().toISOString(),
      isVip: isVip || false,
      timestamp: Date.now(),
    };

    io.to(roomId).emit('receive_room_message', messageData);
  });

  // ─── Room: Raise Hand ────────────────────────────────────────
  socket.on('raise_hand', async ({ roomId, userId, userName }) => {
    socket.to(roomId).emit('raise_hand_notification', {
      userId,
      userName: userName || 'Someone',
      message: `${userName || 'Someone'} wants to speak`,
    });
  });

  // ─── Room: Close Room ────────────────────────────────────────
  socket.on('close_room', async ({ roomId, ownerId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room || room.ownerId.toString() !== ownerId?.toString()) return;

      room.status = 'inactive';
      room.isLive = false;
      room.isActive = false;
      await room.save();

      io.to(roomId).emit('room_closed', {
        message: 'This room has been closed by the owner.',
      });
    } catch (error) {
      console.error('Close Room Error:', error);
    }
  });

  // ─── Room: Delete Room ───────────────────────────────────────
  socket.on('delete_room', async ({ roomId }) => {
    try {
      await Room.findOneAndDelete({ roomId });
    } catch (error) {
      console.error('Delete Room Error:', error);
    }
  });

  // ─── Disconnect cleanup ──────────────────────────────────────
  socket.on('disconnect', async () => {
    // Room cleanup handled in leave_room event
  });
};