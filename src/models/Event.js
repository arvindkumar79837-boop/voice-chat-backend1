const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  event_name: { type: String, required: true, unique: true },
  event_type: {
    type: String,
    enum: ['LOGIN', 'DAILY_TASK', 'RECHARGE', 'RECHARGE_BONUS', 'INVITE', 'FESTIVAL', 'ANNIVERSARY', 'LUCKY_DRAW', 'TREASURE_HUNT', 'TOURNAMENT', 'CHAMPIONSHIP', 'PK_BATTLE', 'WELCOME_WEEK', 'SPIN_REWARD'],
    required: true
  },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  banner_image: { type: String, default: '' },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  reward_details: {
    coins: { type: Number, default: 0 },
    diamonds: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    frames: [{ type: String }],
    badges: [{ type: String }],
    vipDays: { type: Number, default: 0 },
    specialEffects: [{ type: String }],
    bonusPercentage: { type: Number, default: 0 },
    cashPrize: { type: Number, default: 0 },
    vipTag: { type: String, default: '' },
    gifts: [{ type: String }],
    svvipVehicleAccess: { type: String, default: '' }
  },
  is_active: { type: Boolean, default: true },
  is_recurring: { type: Boolean, default: false },
  recurrence_pattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'none'],
    default: 'none'
  },
  requirements: {
    min_level: { type: Number, default: 1 },
    min_days_active: { type: Number, default: 0 },
    min_recharge_amount: { type: Number, default: 0 },
    new_user_only: { type: Boolean, default: false },
    account_age_days: { type: Number, default: 0 },
    specific_countries: [{ type: String }],
    vip_required: { type: Boolean, default: false },
    agency_required: { type: Boolean, default: false },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: ''
    }
  },
  max_participants: { type: Number, default: 0 },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  participants_count: { type: Number, default: 0 },
  metadata: {
    roomId: { type: String, default: '' },
    familyId: { type: String, default: '' },
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
    spinner_enabled: { type: Boolean, default: false },
    treasure_enabled: { type: Boolean, default: false },
    battle_type: { type: String, default: '' },
    theme_color: { type: String, default: '#FFD700' },
    festival_name: { type: String, default: '' },
    prize_pool_amount: { type: Number, default: 0 },
    tournament_rounds: { type: Number, default: 4 },
    top_winners_count: { type: Number, default: 3 },
    recharge_threshold: { type: Number, default: 1000 },
    lucky_draw_ticket_cost: { type: Number, default: 100 },
    welcome_week_day: { type: Number, default: 1 },
    spin_reward_type: { type: String, default: 'coins' }
  },
  config: {
    auto_join: { type: Boolean, default: false },
    notify_users: { type: Boolean, default: true },
    show_on_home: { type: Boolean, default: true },
    highlight_priority: { type: Number, default: 1 },
    allow_multiple_claims: { type: Boolean, default: false }
  },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

eventSchema.index({ event_type: 1, is_active: 1, status: 1, start_time: 1 });
eventSchema.index({ status: 1, start_time: -1 });
eventSchema.index({ created_at: -1 });
eventSchema.index({ 'requirements.new_user_only': 1 });

module.exports = mongoose.model('Event', eventSchema);