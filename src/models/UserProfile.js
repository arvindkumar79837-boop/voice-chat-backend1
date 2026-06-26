const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  coverPhoto: { type: String, default: '' },
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
    showFollowing: { type: Boolean, default: true }
  },
  badges: [{ type: String }],
  isVerified: { type: Boolean, default: false },
  verificationType: { type: String, enum: ['none', 'official_host', 'vip', 'celebrity'], default: 'none' },
  verificationBadge: { type: String, default: '' },
  specialRoles: {
    vipFrame: { type: Boolean, default: false },
    entryEffect: { type: String, default: '' },
    customTitle: { type: String, default: '' }
  }
}, { timestamps: true });

userProfileSchema.index({ userId: 1 });

module.exports = mongoose.model('UserProfile', userProfileSchema);