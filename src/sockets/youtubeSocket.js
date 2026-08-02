const Logger = require('../utils/logger');
const { checkRateLimit, trackPresence } = require('../middlewares/socketSecurity.middleware');
// ═══════════════════════════════════════════════════════════════════════════
// FILE: arvind-party-backend/src/sockets/youtubeSocket.js
// ARVIND PARTY - YOUTUBE SOCKET HANDLER
// ═══════════════════════════════════════════════════════════════════════════

const YouTubePlaylist = require('../models/YouTubePlaylist');

function youtubeSocket(io, socket) {
  Logger.info(`YouTube socket middleware initialized for ${socket.id}`);

  // Join room
  socket.on('youtube:join_room', async ({ roomId }) => {
    try {
      const userId = socket.data.userId;
      if (!userId) return;
      socket.join(roomId);
      
      // Track presence
      await trackPresence(userId, roomId);
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
      Logger.info(`User ${userId} joined YouTube room ${roomId}`);
    } catch (error) {
      Logger.error('Error joining YouTube room:', error);
    }
  });

  // Leave room
  socket.on('youtube:leave_room', async ({ roomId }) => {
    try {
      const userId = socket.data.userId;
      if (!userId) return;
      socket.leave(roomId);
      const playlist = await YouTubePlaylist.findOne({ roomId });
      if (playlist) {
        playlist.participants = playlist.participants.filter(p => p !== userId);
        await playlist.save();
        io.to(roomId).emit('youtube:participants_updated', {
          participants: playlist.participants,
        });
      }
      Logger.info(`User ${userId} left YouTube room ${roomId}`);
    } catch (error) {
      Logger.error('Error leaving YouTube room:', error);
    }
  });

  // Host toggles play/pause
  socket.on('youtube:toggle_play', async ({ roomId, isPlaying }) => {
    try {
      const userId = socket.data.userId;
      
      // Rate limit check
      const allowed = await checkRateLimit(userId, 'youtube_toggle');
      if (!allowed) {
        return socket.emit('error', { message: 'Please wait before toggling playback.' });
      }
      
      socket.to(roomId).emit('youtube:sync_update', {
        isPlaying,
        position: 0,
        videoId: null,
        updatedBy: socket.id,
      });
    } catch (error) {
      Logger.error('[youtube:toggle_play] error:', error.message);
      socket.emit('error', { message: 'Something went wrong. Please try again.' });
    }
  });

  // Host seeks
  socket.on('youtube:seek', async ({ roomId, position }) => {
    try {
      const userId = socket.data.userId;
      
      // Rate limit check
      const allowed = await checkRateLimit(userId, 'youtube_seek');
      if (!allowed) {
        return socket.emit('error', { message: 'Please wait before seeking.' });
      }
      
      socket.to(roomId).emit('youtube:sync_update', {
        isPlaying: true,
        position,
        videoId: null,
        updatedBy: socket.id,
      });
    } catch (error) {
      Logger.error('[youtube:seek] error:', error.message);
      socket.emit('error', { message: 'Something went wrong. Please try again.' });
    }
  });

  // Host changes video
  socket.on('youtube:change_video', async ({ roomId, videoId }) => {
    try {
      const userId = socket.data.userId;
      
      // Rate limit check
      const allowed = await checkRateLimit(userId, 'youtube_change');
      if (!allowed) {
        return socket.emit('error', { message: 'Please wait before changing video.' });
      }
      
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
      Logger.error('Error changing video:', error);
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
      Logger.error('Error toggling watch party:', error);
    }
  });
}

module.exports = youtubeSocket;