const mongoose = require('mongoose');

const eventPrizePoolSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  total_amount: { type: Number, default: 0 },
  currency_type: {
    type: String,
    enum: ['coins', 'diamonds', 'cash', 'mixed'],
    default: 'coins'
  },
  contribution_rules: {
    gift_percentage: { type: Number, default: 10 },
    recharge_percentage: { type: Number, default: 5 },
    min_contribution: { type: Number, default: 0 },
    max_contribution: { type: Number, default: 0 }
  },
  distribution_rules: {
    type: {
      type: String,
      enum: ['winner_takes_all', 'top_3_split', 'top_5_split', 'ranked_percentage', 'equal_split'],
      default: 'top_3_split'
    },
    winners_count: { type: Number, default: 3 },
    percentages: [{ rank: { type: Number }, percentage: { type: Number } }]
  },
  current_amount: { type: Number, default: 0 },
  participants_count: { type: Number, default: 0 },
  is_locked: { type: Boolean, default: false },
  locked_at: { type: Date },
  distributed_at: { type: Date },
  metadata: {
    battle_id: { type: String, default: '' },
    tournament_id: { type: String, default: '' },
    family_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' },
    agency_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' }
  }
}, { timestamps: true });

eventPrizePoolSchema.index({ event_id: 1 });
eventPrizePoolSchema.index({ is_locked: 1 });

module.exports = mongoose.model('EventPrizePool', eventPrizePoolSchema);