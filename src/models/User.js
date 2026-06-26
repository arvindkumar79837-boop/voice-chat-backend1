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
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  diamonds: { type: Number, default: 0 },
  familyId: { type: String, default: null },
  familyRole: { type: String, default: null },
  familyJoinDate: { type: Date },
  familyContribution: { type: Number, default: 0 },
  familyPoints: { type: Number, default: 0 },
  isProfileComplete: { type: Boolean, default: false },
  kyc: {
    status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    pan: { type: String },
    bankAccount: { type: String },
    ifsc: { type: String },
    verifiedAt: { type: Date }
  },
  role: {
    type: String,
    enum: ['user', 'host', 'admin', 'owner', 'coin_seller'],
    default: 'user'
  },
  isCoinSeller: { type: Boolean, default: false },
  coinSellerVerified: { type: Boolean, default: false },
  coinSellerLevel: { type: String, enum: ['silver', 'gold', 'diamond'], default: null },
  coinSellerCommission: { type: Number, default: 0 },
  vipLevel: { type: Number, default: 0 },
  vipExpiry: { type: Date },
  isVip: { type: Boolean, default: false },
  equippedFrame: { type: String, default: null },
  unlockedFrames: { type: [String], default: [] },
  ownedFrames: [{
    frameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Frame' },
    expiresAt: { type: Date }
  }],
  activeFrame: { type: String, default: null },
  activeCar: { type: String, default: null },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', default: null },
  cpPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cpLevel: { type: Number, default: 0 },
  cpRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  totalGiftsSent: { type: Number, default: 0 },
  totalGiftsReceived: { type: Number, default: 0 },
  badges: { type: [String], default: [] },
  unlockedBadges: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  banReason: { type: String },
  bannedAt: { type: Date },
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provider: {
    type: String,
    enum: ['phone', 'email', 'google', 'apple', 'facebook', 'snapchat', 'instagram', 'guest'],
    default: 'phone',
  },
  socialProviders: [{
    provider: { type: String, enum: ['google', 'apple', 'facebook', 'snapchat', 'instagram'] },
    providerUid: { type: String },
    email: { type: String },
    displayName: { type: String },
    photoUrl: { type: String },
    linkedAt: { type: Date, default: Date.now },
  }],
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorMethod: { type: String, enum: ['totp', 'sms_otp', 'email_otp'], default: 'totp' },
  backupCodesGenerated: { type: Boolean, default: false },
  registeredDevices: [{
    fingerprint: { type: String, required: true },
    deviceInfo: {
      platform: { type: String },
      userAgent: { type: String },
      appVersion: { type: String },
      deviceModel: { type: String },
    },
    registeredAt: { type: Date, default: Date.now },
    lastUsed: { type: Date, default: Date.now },
    isTrusted: { type: Boolean, default: false },
  }],
  loginCount: { type: Number, default: 0 },
  lastLoginAt: { type: Date },
  lastLoginIp: { type: String },
  lastLoginLocation: {
    country: { type: String },
    city: { type: String },
  },
  accountRecoveryEmail: { type: String },
  accountRecoveryPhone: { type: String },
  recoveryEmailVerified: { type: Boolean, default: false },
  recoveryPhoneVerified: { type: Boolean, default: false },
  termsAcceptedAt: { type: Date },
  privacyPolicyAcceptedAt: { type: Date },
  isGuest: { type: Boolean, default: false },
  guestExpiresAt: { type: Date },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'pending_verification', 'locked'],
    default: 'active',
  },
  lockReason: { type: String },
  lockedAt: { type: Date },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suspiciousActivityCount: { type: Number, default: 0 },
  lastSuspiciousAt: { type: Date },
  coverPhoto: { type: String, default: '' },
  birthDate: { type: Date },
  registeredAt: { type: Date, default: Date.now },
  socialLinks: {
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    twitter: { type: String, default: '' },
    website: { type: String, default: '' }
  },
  gallery: [{ type: String }],
  privacy: {
    showOnlineStatus: { type: Boolean, default: true },
    showLastSeen: { type: Boolean, default: true },
    showGallery: { type: Boolean, default: true },
    showFollowers: { type: Boolean, default: true },
    showFollowing: { type: Boolean, default: true },
    showVisitorHistory: { type: Boolean, default: true }
  },
  isVerified: { type: Boolean, default: false },
  verificationType: { type: String, enum: ['none', 'official_host', 'vip', 'celebrity'], default: 'none' },
  verificationBadge: { type: String, default: '' },
  blockList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedCount: { type: Number, default: 0 },
  specialRoles: {
    vipFrame: { type: Boolean, default: false },
    entryEffect: { type: String, default: '' },
    customTitle: { type: String, default: '' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.index({ username: 'text', name: 'text' });

userSchema.index({ uid: 1 });
userSchema.index({ familyId: 1 });
userSchema.index({ agencyId: 1 });
userSchema.index({ isVip: -1 });
userSchema.index({ familyRole: 1 });
userSchema.index({ familyContribution: -1 });

module.exports = mongoose.model('User', userSchema);