// ═══════════════════════════════════════════════════════════════════════════
// FILE: arvind-party-backend/src/models/YouTubePlaylist.js
// ARVIND PARTY - YOUTUBE PLAYLIST MODEL
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const YouTubePlaylistSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  videos: [{
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    thumbnailUrl: {
      type: String,
      required: true,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    channelName: {
      type: String,
      default: '',
    },
    duration: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    addedBy: {
      type: String, // userId who added
      default: null,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  currentVideo: {
    id: String,
    position: {
      type: Number,
      default: 0,
    },
    isPlaying: {
      type: Boolean,
      default: false,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  hostId: {
    type: String,
    required: true,
  },
  participants: [{
    type: String,
    default: [],
  }],
  watchPartyEnabled: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('YouTubePlaylist', YouTubePlaylistSchema);