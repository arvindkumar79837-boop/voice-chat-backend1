const Room = require('../models/Room');

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    // User joins a live voice room
    socket.on('join_room', async ({ roomId, userId, userProfile }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) return;

        // 🚫 Check if user was previously kicked
        const isKicked = room.kickedUsers && room.kickedUsers.some(id => id.toString() === userId.toString());
        if (isKicked) {
          return socket.emit('user_kicked', { targetUserId: userId });
        }

        socket.join(roomId);
        
        // Increment active users in the MongoDB database
        await Room.findByIdAndUpdate(roomId, { $inc: { activeUsers: 1 } });
        
        // Notify others in the room
        socket.to(roomId).emit('user_joined', { userId, userProfile, message: `${userProfile?.name || 'A user'} entered the room` });

        // 🔇 Check if user was previously muted
        const isMuted = room.mutedUsers && room.mutedUsers.some(id => id.toString() === userId.toString());
        if (isMuted) {
          socket.emit('user_admin_muted', { targetUserId: userId });
        }
      } catch (error) {
        console.error('Error joining room:', error);
      }
    });

    // User leaves a voice room
    socket.on('leave_room', async ({ roomId, userId, userProfile }) => {
      socket.leave(roomId);
      
      // Decrement active users in the database
      await Room.findByIdAndUpdate(roomId, { $inc: { activeUsers: -1 } });
      
      socket.to(roomId).emit('user_left', { userId, userProfile, message: `${userProfile?.name || 'A user'} left the room` });
    });
    
    // Mic status toggle (mute/unmute)
    socket.on('toggle_mic', ({ roomId, userId, isMuted }) => {
      io.to(roomId).emit('mic_status_changed', { userId, isMuted });
    });

    // 🛠️ Room Moderation: Kick User
    socket.on('kick_user', async ({ roomId, targetUserId, adminId }) => {
      try {
        await Room.findByIdAndUpdate(roomId, { $addToSet: { kickedUsers: targetUserId } });
        io.to(roomId).emit('user_kicked', { targetUserId });
      } catch (error) {
        console.error('Error kicking user:', error);
      }
    });

    // 🛠️ Room Moderation: Admin Mute User
    socket.on('admin_mute_user', async ({ roomId, targetUserId, adminId }) => {
      try {
        await Room.findByIdAndUpdate(roomId, { $addToSet: { mutedUsers: targetUserId } });
        io.to(roomId).emit('user_admin_muted', { targetUserId });
      } catch (error) {
        console.error('Error muting user:', error);
      }
    });

    // 🛠️ Room Moderation: Unkick User (Forgive)
    socket.on('unkick_user', async ({ roomId, targetUserId, adminId }) => {
      try {
        await Room.findByIdAndUpdate(roomId, { $pull: { kickedUsers: targetUserId } });
        io.to(roomId).emit('user_unkicked', { targetUserId });
      } catch (error) {
        console.error('Error unkicking user:', error);
      }
    });

    // 🛠️ Room Moderation: Admin Unmute User
    socket.on('admin_unmute_user', async ({ roomId, targetUserId, adminId }) => {
      try {
        await Room.findByIdAndUpdate(roomId, { $pull: { mutedUsers: targetUserId } });
        io.to(roomId).emit('user_admin_unmuted', { targetUserId });
      } catch (error) {
        console.error('Error unmuting user:', error);
      }
    });
  });
};