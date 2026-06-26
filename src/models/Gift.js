const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema({
  giftName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  giftType: {
    type: String,
    enum: ['STATIC', 'ANIMATED', 'SVGA', '3D', 'LUCKY', 'TREASURE', 'VEHICLE', 'CASTLE', 'FRAME', 'AVATAR', 'FESTIVAL', 'COMBO'],
    required: true,
    default: 'STATIC'
  },
  category: {
    type: String,
    enum: ['HOT', 'BASIC', 'PREMIUM', 'LUXURY', 'VIP', 'LUCKY', 'FESTIVAL'],
    default: 'BASIC'
  },
  coinPrice: {
    type: Number,
    required: true,
    min: 1
  },
  diamondValue: {
    type: Number,
    default: 0
  },
  previewImageUrl: {
    type: String,
    default: ''
  },
  animationUrl: {
    type: String,
    default: ''
  },
  svgaUrl: {
    type: String,
    default: ''
  },
  animationJsonUrl: {
    type: String,
    default: ''
  },
  // Combo gift support
  comboEnabled: {
    type: Boolean,
    default: false
  },
  comboMultipliers: [{
    type: Number,
    default: [1, 5, 10, 99, 999]
  }],
  comboAnimationUrl: {
    type: String,
    default: ''
  },
  // Lucky gift fields
  isLucky: {
    type: Boolean,
    default: false
  },
  luckyMultiplier: [{
    type: Number,
    default: [1, 5, 10, 100, 500]
  }],
  luckyMinCoins: {
    type: Number,
    default: 0
  },
  luckyMaxCoins: {
    type: Number,
    default: 0
  },
  // Treasure gift fields
  isTreasure: {
    type: Boolean,
    default: false
  },
  treasurePoolCoins: {
    type: Number,
    default: 0
  },
  treasureDurationSeconds: {
    type: Number,
    default: 30
  },
  treasureMaxClaimers: {
    type: Number,
    default: 10
  },
  // Vehicle & Castle fields
  vehicleModelUrl: {
    type: String,
    default: ''
  },
  castleModelUrl: {
    type: String,
    default: ''
  },
  displayDurationSeconds: {
    type: Number,
    default: 10
  },
  // Frame & Avatar gift fields
  frameId: {
    type: String,
    default: ''
  },
  frameImageUrl: {
    type: String,
    default: ''
  },
  frameDurationDays: {
    type: Number,
    default: 7
  },
  avatarCustomizationId: {
    type: String,
    default: ''
  },
  // Festival & Event fields
  festivalId: {
    type: String,
    default: ''
  },
  festivalName: {
    type: String,
    default: ''
  },
  isLimitedEdition: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  },
  // VIP requirements
  requiredVipLevel: {
    type: Number,
    default: 0
  },
  // Sort & availability
  sortOrder: {
    type: Number,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
giftSchema.index({ giftType: 1, isAvailable: 1 });
giftSchema.index({ category: 1, sortOrder: 1 });
giftSchema.index({ isLucky: 1 });
giftSchema.index({ isTreasure: 1 });

// Static method to get gifts by type for store display
giftSchema.statics.getStoreGifts = function() {
  return this.find({ isAvailable: true, isActive: true })
    .sort({ sortOrder: 1, coinPrice: 1 })
    .lean();
};

// Static method to get lucky gifts
giftSchema.statics.getLuckyGifts = function() {
  return this.find({ isLucky: true, isAvailable: true, isActive: true }).lean();
};

module.exports = mongoose.model('Gift', giftSchema);