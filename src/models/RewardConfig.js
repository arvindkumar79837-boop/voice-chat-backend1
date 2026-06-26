const mongoose = require('mongoose');

const rewardTierSchema = new mongoose.Schema({
  tierName: { type: String, required: true },
  rarity: { 
    type: String, 
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
    required: true 
  },
  minProbability: { type: Number, required: true, min: 0, max: 100 },
  maxProbability: { type: Number, required: true, min: 0, max: 100 },
  colorCode: { type: String, default: '#FF6B6B' },
  iconUrl: { type: String, default: '' },
  description: { type: String, default: '' }
});

const rewardItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  itemName: { type: String, required: true },
  itemType: { 
    type: String, 
    enum: ['coins', 'diamonds', 'xp', 'frame', 'badge', 'mount', 'entry_effect', 'avatar_decoration', 'chat_bubble', 'seat_frame', 'vip_days', 'rocket', 'entry_car', 'nothing'],
    required: true 
  },
  itemValue: { type: Number, default: 0 },
  assetUrl: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  svgaUrl: { type: String, default: '' },
  tier: { type: String, required: true },
  probability: { type: Number, required: true, min: 0, max: 100 },
  weight: { type: Number, default: 10 },
  isActive: { type: Boolean, default: true },
  isJackpot: { type: Boolean, default: false },
  maxWinPerUser: { type: Number, default: null },
  totalSupply: { type: Number, default: null },
  remainingSupply: { type: Number, default: null },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
});

const rewardConfigSchema = new mongoose.Schema({
  configName: { type: String, required: true, unique: true },
  gameType: { 
    type: String, 
    enum: ['lucky_spin', 'treasure_hunt', 'scratch_card', 'custom'],
    required: true 
  },
  description: { type: String, default: '' },
  entryFeeCoins: { type: Number, default: 0 },
  entryFeeDiamonds: { type: Number, default: 0 },
  spinCostCoins: { type: Number, default: 100 },
  spinCostDiamonds: { type: Number, default: 0 },
  maxSpinsPerUser: { type: Number, default: 10 },
  totalSpinsAllowed: { type: Number, default: 1000 },
  
  tiers: [rewardTierSchema],
  rewardItems: [rewardItemSchema],
  
  jackpotEnabled: { type: Boolean, default: false },
  jackpotPrize: {
    prizeType: { type: String, default: 'jackpot_coins' },
    prizeValue: { type: Number, default: 10000 },
    prizeName: { type: String, default: 'JACKPOT' },
    assetUrl: { type: String, default: '' }
  },
  jackpotCurrentPool: { type: Number, default: 0 },
  jackpotTriggerRate: { type: Number, default: 0.01 },
  
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  version: { type: String, default: '1.0.0' },
  deployedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  totalSpinsUsed: { type: Number, default: 0 },
  totalWinners: { type: Number, default: 0 },
  totalCoinsIn: { type: Number, default: 0 },
  totalRewardsOut: { type: Number, default: 0 },
  analytics: {
    lastUpdated: { type: Date, default: Date.now },
    dailyStats: [{
      date: { type: Date, default: Date.now },
      spins: { type: Number, default: 0 },
      coinsIn: { type: Number, default: 0 },
      rewardsOut: { type: Number, default: 0 },
      uniquePlayers: { type: Number, default: 0 }
    }]
  }
}, { timestamps: true });

rewardConfigSchema.index({ gameType: 1, isActive: 1, startTime: 1, endTime: 1 });
rewardConfigSchema.index({ configName: 1 }, { unique: true });
rewardConfigSchema.index({ deployedBy: 1 });

module.exports = mongoose.model('RewardConfig', rewardConfigSchema);