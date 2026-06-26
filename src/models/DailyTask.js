const mongoose = require('mongoose');

const dailyTaskSchema = new mongoose.Schema({
  task_name: { type: String, required: true },
  description: { type: String, required: true },
  task_type: {
    type: String,
    enum: ['LOGIN', 'ROOM_STAY', 'SEND_MESSAGES', 'SEND_GIFTS', 'JOIN_FAMILY', 'PK_BATTLE', 'SHOP_PURCHASE'],
    required: true
  },
  target_value: { type: Number, required: true },
  reward_coins: { type: Number, default: 0 },
  reward_diamonds: { type: Number, default: 0 },
  reward_xp: { type: Number, default: 0 },
  reward_frames: [{ type: String }],
  reward_badges: [{ type: String }],
  is_active: { type: Boolean, default: true },
  streak_bonus: {
    enabled: { type: Boolean, default: false },
    days_required: { type: Number, default: 7 },
    bonus_multiplier: { type: Number, default: 2 }
  }
}, { timestamps: true });

dailyTaskSchema.index({ task_type: 1, is_active: 1 });

module.exports = mongoose.model('DailyTask', dailyTaskSchema);