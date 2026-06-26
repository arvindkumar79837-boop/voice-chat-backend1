const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
  family_id: { type: String, required: true, unique: true },
  family_name: { type: String, required: true, trim: true },
  family_badge: { type: String, required: true, default: 'TEAM_ARVIND_DEFAULT' },
  family_slogan: { type: String, default: '', trim: true, maxlength: 100 },
  family_intro: { type: String, default: '', trim: true, maxlength: 500 },
  family_logo: { type: String, default: '' },
  creator_uid: { type: String, required: true, index: true },
  current_level: { type: Number, default: 1, min: 1 },
  total_xp: { type: Number, default: 0, min: 0 },
  xp_for_next_level: { type: Number, default: 1000 },
  members_list: [{ type: String, required: true }],
  member_count: { type: Number, default: 0 },
  max_members: { type: Number, default: 50 },
  admins_list: [{
    uid: { type: String, required: true },
    role: { type: String, enum: ['co_leader', 'elder', 'admin'], default: 'admin' },
    assignedAt: { type: Date, default: Date.now }
  }],
  max_admin_slots: { type: Number, default: 5 },
  family_points: { type: Number, default: 0, min: 0 },
  is_active: { type: Boolean, default: true },
  is_banned: { type: Boolean, default: false },
  totalWealth: { type: Number, default: 0 },
  total_gifts_sent: { type: Number, default: 0 },
  announcement: { type: String, default: 'Welcome to our family!' },
  official_room_id: { type: String, default: '' },
  reward_config: {
    top1_reward: { type: String, default: 'Gold Crown + 5000 Coins' },
    top2_reward: { type: String, default: 'Silver Crown + 3000 Coins' },
    top3_reward: { type: String, default: 'Bronze Crown + 1000 Coins' },
    stay_reward_coins_per_5min: { type: Number, default: 10 },
    stay_reward_xp_per_5min: { type: Number, default: 5 },
    custom_rewards_enabled: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  daily_task_progress: {
    gift_target: { type: Number, default: 0 },
    live_target: { type: Number, default: 0 },
    task_date: { type: Date, default: Date.now },
    completed: { type: Boolean, default: false }
  },
  war_stats: {
    wars_participated: { type: Number, default: 0 },
    wars_won: { type: Number, default: 0 },
    total_war_points: { type: Number, default: 0 }
  },
  unlocked_perks: [{ type: String }]
}, { timestamps: true });

familySchema.index({ family_id: 1 });
familySchema.index({ creator_uid: 1 });
familySchema.index({ current_level: -1, total_xp: -1 });
familySchema.index({ is_active: 1, createdAt: -1 });
familySchema.index({ 'war_stats.total_war_points': -1 });

familySchema.virtual('maxAdminSlots').get(function() {
  const levelSlotMap = {
    1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 7: 11, 8: 12, 9: 13, 10: 15,
    11: 17, 12: 19, 13: 21, 14: 23, 15: 25
  };
  return levelSlotMap[this.current_level] || Math.min(5 + this.current_level, 30);
});

familySchema.virtual('maxMembers').get(function() {
  return Math.min(50 + (this.current_level * 10), 500);
});

familySchema.set('toJSON', { virtuals: true });
familySchema.set('toObject', { virtuals: true });

familySchema.methods.addXP = function(xp) {
  this.total_xp += xp;
  const levelThresholds = {
    1: 1000, 2: 2000, 3: 5000, 4: 10000, 5: 20000, 6: 35000, 7: 55000, 8: 80000, 9: 120000, 10: 200000
  };
  const requiredXP = levelThresholds[this.current_level] || (this.current_level * 25000);
  this.xp_for_next_level = requiredXP;
  if (this.total_xp >= requiredXP) {
    this.current_level += 1;
    this.total_xp -= requiredXP;
    this.xp_for_next_level = levelThresholds[this.current_level] || (this.current_level * 25000);
  }
  this.updatedAt = Date.now();
};

familySchema.methods.getMaxMembers = function() {
  return Math.min(50 + (this.current_level * 10), 500);
};

module.exports = mongoose.model('Family', familySchema);