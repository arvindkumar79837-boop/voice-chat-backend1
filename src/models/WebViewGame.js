const mongoose = require('mongoose');

const webViewGameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  gameType: {
    type: String,
    enum: ['RENTED', 'IN_HOUSE', 'WEB_BASED'],
    required: true
  },
  gameUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  minBetAmount: {
    type: Number,
    default: 10,
    min: 0
  },
  maxBetAmount: {
    type: Number,
    default: 10000,
    min: 0
  },
  houseEdgePercentage: {
    type: Number,
    default: 5,
    min: 0,
    max: 100
  },
  rewardType: {
    type: String,
    enum: ['COINS', 'DIAMONDS', 'BOTH'],
    default: 'COINS'
  },
  coinToDiamondRatio: {
    type: Number,
    default: 100
  },
  diamondToCoinRatio: {
    type: Number,
    default: 0.01
  },
  totalPlays: {
    type: Number,
    default: 0
  },
  totalVolume: {
    type: Number,
    default: 0
  },
  totalWinnings: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  configuration: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

webViewGameSchema.index({ gameType: 1, isActive: 1 });
webViewGameSchema.index({ createdBy: 1 });

module.exports = mongoose.model('WebViewGame', webViewGameSchema);