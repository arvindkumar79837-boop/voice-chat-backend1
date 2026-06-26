const mongoose = require('mongoose');

const championshipSchema = new mongoose.Schema({
  championship_name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  period_type: {
    type: String,
    enum: ['MONTHLY', 'YEARLY'],
    required: true
  },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
  qualification_start: { type: Date, required: true },
  qualification_end: { type: Date, required: true },
  rewards: {
    winner: {
      coins: { type: Number, default: 0 },
      diamonds: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      vipDays: { type: Number, default: 0 },
      vipTag: { type: String, default: 'Global Champion' },
      cashPrize: { type: Number, default: 0 },
      specialFrame: { type: String, default: '' },
      globalAnimation: { type: Boolean, default: true }
    },
    runner_up: {
      coins: { type: Number, default: 0 },
      diamonds: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      vipDays: { type: Number, default: 0 },
      vipTag: { type: String, default: 'Elite Champion' },
      cashPrize: { type: Number, default: 0 }
    },
    third_place: {
      coins: { type: Number, default: 0 },
      diamonds: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      vipDays: { type: Number, default: 0 },
      vipTag: { type: String, default: 'Master Champion' },
      cashPrize: { type: Number, default: 0 }
    },
    top100: {
      coins: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      vipDays: { type: Number, default: 0 }
    }
  },
  status: {
    type: String,
    enum: ['upcoming', 'qualification', 'live', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  criteria: {
    metric: {
      type: String,
      enum: ['total_gifts_sent', 'total_gifts_received', 'total_coins', 'total_diamonds', 'pk_wins', 'family_contribution'],
      default: 'total_gifts_sent'
    },
    min_score: { type: Number, default: 0 },
    max_participants: { type: Number, default: 1000 }
  },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    score: { type: Number, default: 0 },
    qualified_at: { type: Date },
    final_rank: { type: Number, default: 0 },
    rewards_claimed: { type: Boolean, default: false }
  }],
  participants_count: { type: Number, default: 0 },
  winner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winner_username: { type: String },
  is_active: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  announcement_sent: { type: Boolean, default: false }
}, { timestamps: true });

championshipSchema.index({ period_type: 1, status: 1, start_time: -1 });
championshipSchema.index({ status: 1, qualification_end: 1 });
championshipSchema.index({ created_at: -1 });

module.exports = mongoose.model('Championship', championshipSchema);