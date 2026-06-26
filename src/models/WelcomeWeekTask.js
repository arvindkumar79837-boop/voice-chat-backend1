const mongoose = require('mongoose');

const welcomeWeekTaskSchema = new mongoose.Schema({
  task_name: { type: String, required: true },
  task_description: { type: String, required: true },
  day_number: { type: Number, required: true, min: 1, max: 7 },
  task_type: {
    type: String,
    enum: ['login', 'profile_update', 'first_gift', 'join_room', 'follow_streamer', 'first_recharge', 'share_app'],
    required: true
  },
  target_count: { type: Number, default: 1 },
  reward_coins: { type: Number, default: 0 },
  reward_diamonds: { type: Number, default: 0 },
  reward_badge_id: { type: String, default: '' },
  reward_frame_id: { type: String, default: '' },
  reward_xp: { type: Number, default: 0 },
  is_mandatory: { type: Boolean, default: false },
  display_order: { type: Number, default: 0 },
  icon_url: { type: String, default: '' },
  tips: { type: String, default: '' }
}, { timestamps: true });

welcomeWeekTaskSchema.index({ day_number: 1, display_order: 1 });
welcomeWeekTaskSchema.index({ task_type: 1 });

module.exports = mongoose.model('WelcomeWeekTask', welcomeWeekTaskSchema);