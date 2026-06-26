// ═══════════════════════════════════════════════════════════════════════════
// FILE: arvind-party-backend/src/sockets/youtubeSocket.js
// ARVIND PARTY - YOUTUBE SOCKET HANDLER
// ═══════════════════════════════════════════════════════════════════════════

const YouTubePlaylist = require('../models/YouTubePlaylist');

function youtubeSocket(io, socket) {
  console.log(`YouTube socket middleware initialized for ${socket.id}`);

  // Join room
  socket.on('youtube:join_room', async ({ roomId, userId }) => {
    try {
      socket.join(roomId);
      const playlist = await YouTubePlaylist.findOne({ roomId });
      if (playlist) {
        if (!playlist.participants.includes(userId)) {
          playlist.participants.push(userId);
          await playlist.save();
        }
        io.to(roomId).emit('youtube:participants_updated', {
          participants: playlist.participants,
        });
      }
      console.log(`User ${userId} joined YouTube room ${roomId}`);
    } catch (error) {
      console.error('Error joining YouTube room:', error);
    }
  });

  // Leave room
  socket.on('youtube:leave_room', async ({ roomId, userId }) => {
    try {
      socket.leave(roomId);
      const playlist = await YouTubePlaylist.findOne({ roomId });
      if (playlist) {
        playlist.participants = playlist.participants.filter(p => p !== userId);
        await playlist.save();
        io.to(roomId).emit('youtube:participants_updated', {
          participants: playlist.participants,
        });
      }
      console.log(`User ${userId} left YouTube room ${roomId}`);
    } catch (error) {
      console.error('Error leaving YouTube room:', error);
    }
  });

  // Host toggles play/pause
  socket.on('youtube:toggle_play', ({ roomId, isPlaying }) => {
    socket.to(roomId).emit('youtube:sync_update', {
      isPlaying,
      position: 0,
      videoId: null,
      updatedBy: socket.id,
    });
  });

  // Host seeks
  socket.on('youtube:seek', ({ roomId, position }) => {
    socket.to(roomId).emit('youtube:sync_update', {
      isPlaying: true,
      position,
      videoId: null,
      updatedBy: socket.id,
    });
  });

  // Host changes video
  socket.on('youtube:change_video', async ({ roomId, videoId }) => {
    try {
      const playlist = await YouTubePlaylist.findOne({ roomId });
      if (playlist) {
        const video = playlist.videos.find(v => v.id === videoId);
        if (video) {
          playlist.currentVideo = {
            id: video.id,
            position: 0,
            isPlaying: true,
            updatedAt: new Date(),
          };
          await playlist.save();
          socket.to(roomId).emit('youtube:video_changed', video);
        }
      }
    } catch (error) {
      console.error('Error changing video:', error);
    }
  });

  // Toggle watch party
  socket.on('youtube:toggle_watch_party', async ({ roomId, enabled }) => {
    try {
      const playlist = await YouTubePlaylist.findOne({ roomId });
      if (playlist) {
        playlist.watchPartyEnabled = enabled;
        await playlist.save();
        socket.to(roomId).emit('youtube:watch_party_toggled', { enabled });
      }
    } catch (error) {
      console.error('Error toggling watch party:', error);
    }
  });
}

module.exports = youtubeSocket;