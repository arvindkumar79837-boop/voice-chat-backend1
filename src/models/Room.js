const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  seatIndex: {
    type: Number,
    required: true,
    min: 0,
    max: 31
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  userName: {
    type: String,
    default: ''
  },
  userAvatar: {
    type: String,
    default: ''
  },
  isMuted: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  isHost: {
    type: Boolean,
    default: false
  },
  joinedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const roomCosmeticsSchema = new mongoose.Schema({
  backgroundUrl: {
    type: String,
    default: ''
  },
  backgroundName: {
    type: String,
    default: 'Default'
  },
  themeColor: {
    type: String,
    default: '#FF6B6B'
  },
  isAnimated: {
    type: Boolean,
    default: false
  },
  purchasedBackgrounds: [{
    backgroundId: String,
    backgroundName: String,
    backgroundUrl: String,
    purchasedAt: { type: Date, default: Date.now }
  }]
}, { _id: false });

const roomTaskSchema = new mongoose.Schema({
  taskId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  targetValue: {
    type: Number,
    required: true
  },
  currentValue: {
    type: Number,
    default: 0
  },
  rewardCoins: {
    type: Number,
    default: 0
  },
  rewardXp: {
    type: Number,
    default: 0
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const pKChallengeSchema = new mongoose.Schema({
  challengeId: {
    type: String,
    required: true
  },
  challengerRoomId: {
    type: String,
    required: true
  },
  challengerRoomName: {
    type: String,
    default: ''
  },
  opponentRoomId: {
    type: String,
    required: true
  },
  opponentRoomName: {
    type: String,
    default: ''
  },
  challengerScore: {
    type: Number,
    default: 0
  },
  opponentScore: {
    type: Number,
    default: 0
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  winnerRoomId: {
    type: String,
    default: null
  }
}, { _id: false });

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    default: "My Voice Room"
  },
  description: {
    type: String,
    default: ""
  },
  coverImage: {
    type: String,
    default: ""
  },
  tags: [{
    type: String
  }],
  language: {
    type: String,
    default: "English"
  },
  roomType: {
    type: String,
    enum: ['PUBLIC', 'PRIVATE', 'PASSWORD', 'THEME', 'KARAOKE', 'GAME', 'FAMILY', 'AGENCY'],
    default: 'PUBLIC'
  },
  roomPassword: {
    type: String,
    default: ""
  },
  roomCategory: {
    type: String,
    enum: ['voice', 'music', 'gaming', 'chat', 'event', 'meeting', 'podcast', 'social'],
    default: 'voice'
  },
  activeUsers: {
    type: Number,
    default: 0,
    min: 0
  },
  seats: {
    type: [seatSchema],
    default: () => {
      const defaultSeats = [];
      for (let i = 0; i < 8; i++) {
        defaultSeats.push({
          seatIndex: i,
          userId: null,
          userName: '',
          userAvatar: '',
          isMuted: false,
          isLocked: false,
          isHost: false,
          joinedAt: null
        });
      }
      return defaultSeats;
    }
  },
  seatCount: {
    type: Number,
    default: 8,
    min: 2,
    max: 32
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned', 'live'],
    default: 'active'
  },
  isLive: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Room Cosmetics & Theme
  cosmetics: {
    type: roomCosmeticsSchema,
    default: () => ({})
  },
  // Room PK Battle
  currentPkChallenge: {
    type: pKChallengeSchema,
    default: null
  },
  pkWins: {
    type: Number,
    default: 0
  },
  pkLosses: {
    type: Number,
    default: 0
  },
  pkPoints: {
    type: Number,
    default: 0
  },
  // Room Tasks
  dailyTasks: {
    type: [roomTaskSchema],
    default: []
  },
  // Room Ranking Points
  rankPoints: {
    type: Number,
    default: 0
  },
  totalGiftPoints: {
    type: Number,
    default: 0
  },
  totalTrafficMinutes: {
    type: Number,
    default: 0
  },
  // Room Loot Box
  lootBoxPoints: {
    type: Number,
    default: 0
  },
  lootBoxLevel: {
    type: Number,
    default: 1
  },
  // Family/Agency association
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    default: null
  },
  agencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agency',
    default: null
  },
  // Kick/Mute lists
  kickedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  mutedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // LiveKit room name
  liveKitRoom: {
    type: String,
    default: ''
  },
  // Room Messages / Announcements
  announcement: {
    type: String,
    default: ''
  },
  pinnedMessage: {
    type: String,
    default: ''
  },
  welcomeMessage: {
    type: String,
    default: ''
  },
  topic: {
    type: String,
    default: ''
  },
  // Co-host & admin lists
  coHosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Index for efficient room queries
roomSchema.index({ roomType: 1, status: 1 });
roomSchema.index({ isLive: 1, status: 1 });
roomSchema.index({ rankPoints: -1 });
roomSchema.index({ totalGiftPoints: -1 });
roomSchema.index({ ownerId: 1 });

// Pre-save hook to sync isActive with status
roomSchema.pre('save', function(next) {
  if (this.status === 'active' || this.status === 'live') {
    this.isActive = true;
  } else {
    this.isActive = false;
  }
  next();
});

// Method to generate a unique readable room ID
roomSchema.statics.generateRoomId = function() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RM${timestamp}${random}`;
};

module.exports = mongoose.model('Room', roomSchema);