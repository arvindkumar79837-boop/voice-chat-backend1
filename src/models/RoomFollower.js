const mongoose = require('mongoose');

const roomFollowerSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    default: ''
  },
  userAvatar: {
    type: String,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isModerator: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['member', 'admin', 'moderator'],
    default: 'member'
  },
  promotedAt: {
    type: Date,
    default: null
  },
  promotedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  totalVisits: {
    type: Number,
    default: 1
  },
  totalMinutesSpent: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

roomFollowerSchema.index({ roomId: 1, userId: 1 }, { unique: true });
roomFollowerSchema.index({ roomId: 1, isAdmin: 1 });
roomFollowerSchema.index({ roomId: 1, lastActiveAt: -1 });

module.exports = mongoose.model('RoomFollower', roomFollowerSchema);