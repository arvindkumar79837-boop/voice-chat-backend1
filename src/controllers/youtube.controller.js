// ═══════════════════════════════════════════════════════════════════════════
// FILE: arvind-party-backend/src/controllers/youtube.controller.js
// ARVIND PARTY - YOUTUBE CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const YouTubePlaylist = require('../models/YouTubePlaylist');
const axios = require('axios');

const youtubeController = {
  // Get room playlist
  getPlaylist: async (req, res) => {
    try {
      const { roomId } = req.params;
      if (!roomId) {
        return res.status(400).json({ success: false, message: 'roomId is required' });
      }
      const playlist = await YouTubePlaylist.findOne({ roomId });
      res.json({ success: true, videos: playlist?.videos || [], hostId: playlist?.hostId, watchPartyEnabled: playlist?.watchPartyEnabled, currentVideo: playlist?.currentVideo });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Search videos via YouTube Data API v3
  searchVideos: async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ success: false, message: 'Query is required' });
      }

      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, message: 'YouTube API key not configured' });
      }

      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          q,
          part: 'snippet',
          type: 'video',
          maxResults: 25,
          key: apiKey,
        },
      });

      const videos = response.data.items.map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        channelName: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
      }));

      res.json({ success: true, videos });
    } catch (error) {
      console.error('YouTube Search Error:', error.response?.data || error.message);
      res.status(500).json({ success: false, message: 'Failed to search YouTube videos' });
    }
  },

  // Add video to playlist
  addToPlaylist: async (req, res) => {
    try {
      const { roomId } = req.body;
      const videoData = req.body.video;
      if (!roomId || !videoData?.id) {
        return res.status(400).json({ success: false, message: 'roomId and video are required' });
      }
      let playlist = await YouTubePlaylist.findOne({ roomId });
      if (!playlist) {
        playlist = await YouTubePlaylist.create({ roomId, videos: [] });
      }
      const exists = playlist.videos.some(v => v.id === videoData.id);
      if (exists) {
        return res.json({ success: true, message: 'Video already in playlist' });
      }
      playlist.videos.push(videoData);
      await playlist.save();
      // Emit socket event
      const io = req.app.get('io');
      io.to(roomId).emit('youtube:playlist_updated', { videos: playlist.videos });
      res.json({ success: true, videos: playlist.videos });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Remove video from playlist
  removeFromPlaylist: async (req, res) => {
    try {
      const { roomId, videoId } = req.params;
      const playlist = await YouTubePlaylist.findOne({ roomId });
      if (!playlist) {
        return res.status(404).json({ success: false, message: 'Playlist not found' });
      }
      playlist.videos = playlist.videos.filter(v => v.id !== videoId);
      await playlist.save();
      const io = req.app.get('io');
      io.to(roomId).emit('youtube:playlist_updated', { videos: playlist.videos });
      res.json({ success: true, videos: playlist.videos });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update playback state
  updatePlaybackState: async (req, res) => {
    try {
      const { roomId, isPlaying, position, videoId } = req.body;
      const io = req.app.get('io');
      io.to(roomId).emit('youtube:sync_update', { isPlaying, position, videoId, updatedBy: req.user?._id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = youtubeController;