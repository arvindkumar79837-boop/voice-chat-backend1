const mongoose = require('mongoose');

const levelRewardSchema = new mongoose.Schema({
  level: { type: Number, required: true },
  xpRequired: { type: Number, required: true },
  adminSlots: { type: Number, default: 8 },
  seatCapacity: { type: Number, default: 12 },
  badgeUrl: { type: String, default: '' },
  entryEffectUrl: { type: String, default: '' },
  themeUnlocked: { type: String, default: '' },
  rewards: {
    coins: { type: Number, default: 0 },
    diamonds: { type: Number, default: 0 },
    titleUnlocked: { type: String, default: '' }
  }
}, { _id: false });

const roomLevelSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  currentLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: 50
  },
  currentXp: {
    type: Number,
    default: 0,
    min: 0
  },
  totalXpEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  xpBreakdown: {
    chatMessages: { type: Number, default: 0 },
    giftsReceived: { type: Number, default: 0 },
    timeSpentMinutes: { type: Number, default: 0 },
    newFollowers: { type: Number, default: 0 },
    miniGamesPlayed: { type: Number, default: 0 }
  },
  unlockedBadges: [{
    badgeId: { type: String },
    badgeName: { type: String },
    badgeUrl: { type: String },
    unlockedAt: { type: Date, default: Date.now }
  }],
  unlockedThemes: [{
    themeId: { type: String },
    themeName: { type: String },
    unlockedAt: { type: Date, default: Date.now }
  }],
  unlockedEntryEffects: [{
    effectId: { type: String },
    effectName: { type: String },
    effectUrl: { type: String },
    unlockedAt: { type: Date, default: Date.now }
  }],
  lastXpGainAt: { type: Date, default: Date.now },
  leveledUpAt: { type: Date, default: null }
}, {
  timestamps: true
});

roomLevelSchema.index({ currentLevel: -1, totalXpEarned: -1 });

roomLevelSchema.statics.getLevelConfig = function(level) {
  const levelConfigs = {};
  for (let i = 1; i <= 50; i++) {
    const xpRequired = Math.floor(100 * Math.pow(1.2, i - 1));
    let adminSlots = 8;
    let seatCapacity = 12;
    let badgeUrl = '';
    let entryEffectUrl = '';
    let themeUnlocked = '';
    let coins = 0;
    let diamonds = 0;
    let titleUnlocked = '';

    if (i >= 3) { adminSlots = 10; seatCapacity = 15; }
    if (i >= 5) { adminSlots = 12; seatCapacity = 18; badgeUrl = `/badges/level${i}.png`; }
    if (i >= 8) { adminSlots = 15; seatCapacity = 22; coins = 500; }
    if (i >= 10) { adminSlots = 18; seatCapacity = 30; diamonds = 100; titleUnlocked = 'Rising Star'; }
    if (i >= 15) { adminSlots = 22; seatCapacity = 35; themeUnlocked = 'royal_gold'; }
    if (i >= 20) { adminSlots = 25; seatCapacity = 40; entryEffectUrl = '/effects/level20_entry.gif'; }
    if (i >= 25) { adminSlots = 28; seatCapacity = 45; titleUnlocked = 'Room Legend'; }
    if (i >= 30) { adminSlots = 32; seatCapacity = 50; themeUnlocked = 'galaxy_nexus'; }
    if (i >= 40) { adminSlots = 36; seatCapacity = 55; entryEffectUrl = '/effects/level40_entry.gif'; }
    if (i >= 50) { adminSlots = 40; seatCapacity = 60; titleUnlocked = 'Ultimate Host'; }

    levelConfigs[i] = { level: i, xpRequired, adminSlots, seatCapacity, badgeUrl, entryEffectUrl, themeUnlocked, rewards: { coins, diamonds, titleUnlocked } };
  }
  return levelConfigs[level] || levelConfigs[1];
};

roomLevelSchema.statics.getXpForAction = function(action) {
  const xpMap = {
    chat_message: 5,
    gift_received_small: 10,
    gift_received_medium: 25,
    gift_received_large: 50,
    gift_received_mega: 100,
    minute_spent: 2,
    new_follower: 30,
    mini_game_played: 15,
    mini_game_won: 40,
    seat_occupied_minute: 1
  };
  return xpMap[action] || 1;
};

roomLevelSchema.methods.addXp = async function(action, multiplier = 1) {
  const xpGain = roomLevelSchema.statics.getXpForAction(action) * multiplier;
  this.currentXp += xpGain;
  this.totalXpEarned += xpGain;
  this.lastXpGainAt = new Date();

  if (action.startsWith('chat_')) this.xpBreakdown.chatMessages += xpGain;
  else if (action.startsWith('gift_')) this.xpBreakdown.giftsReceived += xpGain;
  else if (action === 'minute_spent') this.xpBreakdown.timeSpentMinutes += 1;
  else if (action.startsWith('mini_game')) this.xpBreakdown.miniGamesPlayed += xpGain;

  let leveledUp = false;
  const levelConfig = roomLevelSchema.statics.getLevelConfig(this.currentLevel);
  while (this.currentXp >= levelConfig.xpRequired && this.currentLevel < 50) {
    this.currentXp -= levelConfig.xpRequired;
    this.currentLevel += 1;
    this.leveledUpAt = new Date();
    leveledUp = true;
    const nextConfig = roomLevelSchema.statics.getLevelConfig(this.currentLevel);
    if (nextConfig.badgeUrl && !this.unlockedBadges.find(b => b.badgeId === `level_${this.currentLevel}`)) {
      this.unlockedBadges.push({ badgeId: `level_${this.currentLevel}`, badgeName: `Level ${this.currentLevel} Badge`, badgeUrl: nextConfig.badgeUrl });
    }
    if (nextConfig.themeUnlocked && !this.unlockedThemes.find(t => t.themeId === nextConfig.themeUnlocked)) {
      this.unlockedThemes.push({ themeId: nextConfig.themeUnlocked, themeName: nextConfig.themeUnlocked.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), unlockedAt: new Date() });
    }
    if (nextConfig.entryEffectUrl && !this.unlockedEntryEffects.find(e => e.effectId === `entry_${this.currentLevel}`)) {
      this.unlockedEntryEffects.push({ effectId: `entry_${this.currentLevel}`, effectName: `Level ${this.currentLevel} Entry Effect`, effectUrl: nextConfig.entryEffectUrl });
    }
  }
  await this.save();
  return { leveledUp, newLevel: this.currentLevel, xpGained: xpGain, totalXp: this.totalXpEarned };
};

module.exports = mongoose.model('RoomLevel', roomLevelSchema);