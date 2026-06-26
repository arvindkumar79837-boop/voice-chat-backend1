const mongoose = require('mongoose');

const VipSystemSchema = new mongoose.Schema({
  user_uid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // VIP Level 1-15 (normal VIP earned via recharge/gifting)
  vip_level: {
    type: Number,
    default: 0,
    min: 0,
    max: 15
  },
  vip_xp: {
    type: Number,
    default: 0
  },
  // SVIP (Super VIP) - manually activated by owner/VIP manager
  is_svip: {
    type: Boolean,
    default: false
  },
  svip_level: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  svip_activated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  svip_activated_at: Date,
  svip_package_name: String,
  // Premium subscription (monthly via coins)
  is_premium: {
    type: Boolean,
    default: false
  },
  premium_expiry: Date,
  premium_auto_renew: {
    type: Boolean,
    default: false
  },
  premium_last_renewed: Date,
  // Active cosmetics
  active_cosmetics: {
    frame_id: { type: String, default: '' },
    entrance_car_id: { type: String, default: '' },
    name_color: { type: String, default: '#FFFFFF' },
    chat_bubble_id: { type: String, default: '' },
    badge_id: { type: String, default: '' }
  },
  // Unlocked cosmetics collection
  unlocked_frames: [{
    frame_id: String,
    frame_name: String,
    frame_url: String,
    unlocked_at: { type: Date, default: Date.now },
    is_animated: { type: Boolean, default: false }
  }],
  unlocked_entrance_cars: [{
    car_id: String,
    car_name: String,
    car_animation_url: String,
    unlocked_at: { type: Date, default: Date.now },
    animation_duration_ms: { type: Number, default: 3000 }
  }],
  unlocked_name_colors: [{
    color_id: String,
    color_name: String,
    hex_code: String,
    is_gradient: { type: Boolean, default: false },
    gradient_colors: [String],
    unlocked_at: { type: Date, default: Date.now }
  }],
  unlocked_chat_bubbles: [{
    bubble_id: String,
    bubble_name: String,
    bubble_url: String,
    unlocked_at: { type: Date, default: Date.now },
    is_animated: { type: Boolean, default: false }
  }],
  unlocked_badges: [{
    badge_id: String,
    badge_name: String,
    badge_url: String,
    unlocked_at: { type: Date, default: Date.now }
  }],
  // VIP Missions progress
  vip_missions: [{
    mission_id: String,
    mission_name: String,
    mission_type: {
      type: String,
      enum: ['recharge', 'gift', 'gaming', 'social', 'daily', 'special'],
      default: 'daily'
    },
    target_value: { type: Number, default: 0 },
    current_progress: { type: Number, default: 0 },
    is_completed: { type: Boolean, default: false },
    reward_claimed: { type: Boolean, default: false },
    reward_type: String,
    reward_value: Number,
    expires_at: Date,
    started_at: { type: Date, default: Date.now },
    completed_at: Date
  }],
  // VIP XP history log
  xp_history: [{
    amount: Number,
    source: {
      type: String,
      enum: ['recharge', 'gift_sent', 'gift_received', 'mission', 'bonus', 'admin'],
      default: 'recharge'
    },
    previous_level: Number,
    new_level: Number,
    description: String,
    created_at: { type: Date, default: Date.now }
  }],
  // Special VIP store purchase history
  vip_shop_purchases: [{
    item_id: String,
    item_name: String,
    item_type: {
      type: String,
      enum: ['frame', 'entrance_car', 'name_color', 'chat_bubble', 'badge', 'emote', 'gift'],
      default: 'frame'
    },
    cost_coins: Number,
    purchased_at: { type: Date, default: Date.now },
    vip_level_required: Number
  }],
  // VIP notification settings
  vip_global_alerts_enabled: {
    type: Boolean,
    default: true
  },
  total_recharge_amount: {
    type: Number,
    default: 0
  },
  total_gift_received_value: {
    type: Number,
    default: 0
  },
  total_gift_sent_value: {
    type: Number,
    default: 0
  },
  vip_xp_to_next_level: {
    type: Number,
    default: 1000
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

VipSystemSchema.index({ vip_level: 1 });
VipSystemSchema.index({ is_svip: 1, svip_level: -1 });
VipSystemSchema.index({ is_premium: 1, premium_expiry: 1 });

// VIP XP thresholds for levels 1-15
const VIP_XP_THRESHOLDS = {
  1: 0,
  2: 500,
  3: 1500,
  4: 3000,
  5: 6000,
  6: 10000,
  7: 16000,
  8: 25000,
  9: 40000,
  10: 60000,
  11: 90000,
  12: 130000,
  13: 180000,
  14: 240000,
  15: 320000
};

VipSystemSchema.statics.getXPForLevel = function(level) {
  return VIP_XP_THRESHOLDS[level] || 0;
};

VipSystemSchema.statics.getLevelFromXP = function(xp) {
  let level = 1;
  for (let i = 15; i >= 1; i--) {
    if (xp >= VIP_XP_THRESHOLDS[i]) {
      level = i;
      break;
    }
  }
  return level;
};

VipSystemSchema.statics.getXPForNextLevel = function(currentXP, currentLevel) {
  if (currentLevel >= 15) return 0;
  const nextLevelXP = VIP_XP_THRESHOLDS[currentLevel + 1];
  return nextLevelXP - currentXP;
};

// SVIP level configuration
const SVIP_CONFIG = {
  1: { min_recharge: 50000, monthly_coins: 5000, name_color: '#FFD700' },
  2: { min_recharge: 150000, monthly_coins: 15000, name_color: '#FF4500' },
  3: { min_recharge: 500000, monthly_coins: 50000, name_color: '#8A2BE2' },
  4: { min_recharge: 1500000, monthly_coins: 150000, name_color: '#00CED1' },
  5: { min_recharge: 5000000, monthly_coins: 500000, name_color: '#FF1493' }
};

VipSystemSchema.statics.getSVIPConfig = function(level) {
  return SVIP_CONFIG[level] || null;
};

module.exports = mongoose.model('VipSystem', VipSystemSchema);
module.exports.VIP_XP_THRESHOLDS = VIP_XP_THRESHOLDS;
module.exports.SVIP_CONFIG = SVIP_CONFIG;