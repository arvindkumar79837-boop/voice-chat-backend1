const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  arvindId: { type: String, sparse: true },
  firebaseUid: { type: String, sparse: true, unique: true },
  phone: { type: String, sparse: true },
  email: { type: String, sparse: true },
  username: { type: String, required: true, unique: true },
  displayName: { type: String },
  name: { type: String },
  avatar: { type: String },
  bio: { type: String, default: '' },

  // Profile Status
  isProfileComplete: { type: Boolean, default: false },

  // KYC
  kyc: {
    status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    pan: { type: String },
    bankAccount: { type: String },
    ifsc: { type: String },
    verifiedAt: { type: Date }
  },

  // Roles
  role: {
    type: String,
    enum: ['user', 'host', 'admin', 'owner'],
    default: 'user'
  },

  // XP & Level
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },

  // Virtual Currency
  coins: { type: Number, default: 0 },
  diamonds: { type: Number, default: 0 },

  // VIP
  vipLevel: { type: Number, default: 0 },
  vipExpiry: { type: Date },
  isVip: { type: Boolean, default: false },

  // Frames & Inventory
  equippedFrame: { type: String, default: null },
  unlockedFrames: { type: [String], default: [] },
  ownedFrames: [{
    frameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Frame' },
    expiresAt: { type: Date }
  }],
  activeFrame: { type: String, default: null },
  activeCar: { type: String, default: null },

  // Family System
  familyId: { type: String, default: null },
  familyRole: { type: String, default: null },
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', default: null },

  // Agency
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', default: null },

  // Couple (CP) System
  cpPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cpLevel: { type: Number, default: 0 },
  cpRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Social / Follow System
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Stats
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  totalGiftsSent: { type: Number, default: 0 },
  totalGiftsReceived: { type: Number, default: 0 },

  // Badges
  badges: { type: [String], default: [] },
  unlockedBadges: { type: [String], default: [] },

  // Status
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  banReason: { type: String },
  bannedAt: { type: Date },
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Security
  deviceFlags: [{
    deviceId: String,
    flag: String,
    flaggedAt: Date
  }],
  suspiciousActivityCount: { type: Number, default: 0 },

  // Timestamps
  lastLoginAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes are already created by unique: true and sparse: true in schema fields

module.exports = mongoose.model('User', userSchema);
