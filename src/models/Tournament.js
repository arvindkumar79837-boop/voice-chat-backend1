const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  tournament_name: { type: String, required: true },
  description: { type: String, required: true },
  event_type: {
    type: String,
    enum: ['PK_BATTLE', 'GIFTING', 'ROOM_TRAFFIC', 'FAMILY_POINTS'],
    required: true
  },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
  registration_start: { type: Date, required: true },
  registration_end: { type: Date, required: true },
  max_participants: { type: Number, default: 100 },
  min_participants: { type: Number, default: 2 },
  entry_fee: { type: Number, default: 0 },
  rewards: {
    first: {
      coins: { type: Number, default: 0 },
      diamonds: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      vipDays: { type: Number, default: 0 },
      vipTag: { type: String, default: '' },
      cashPrize: { type: Number, default: 0 }
    },
    second: {
      coins: { type: Number, default: 0 },
      diamonds: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      vipDays: { type: Number, default: 0 },
      vipTag: { type: String, default: '' },
      cashPrize: { type: Number, default: 0 }
    },
    third: {
      coins: { type: Number, default: 0 },
      diamonds: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      vipDays: { type: Number, default: 0 },
      vipTag: { type: String, default: '' },
      cashPrize: { type: Number, default: 0 }
    },
    participation: {
      coins: { type: Number, default: 0 },
      xp: { type: Number, default: 0 }
    }
  },
  status: {
    type: String,
    enum: ['upcoming', 'registration_open', 'live', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  current_round: { type: Number, default: 1 },
  total_rounds: { type: Number, default: 1 },
  bracket_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    registered_at: { type: Date, default: Date.now },
    current_round: { type: Number, default: 1 },
    score: { type: Number, default: 0 },
    is_eliminated: { type: Boolean, default: false },
    final_rank: { type: Number, default: 0 }
  }],
  participants_count: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metadata: {
    roomId: { type: String, default: '' },
    familyId: { type: String, default: '' },
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' }
  }
}, { timestamps: true });

tournamentSchema.index({ status: 1, start_time: -1 });
tournamentSchema.index({ event_type: 1, is_active: 1 });
tournamentSchema.index({ created_at: -1 });

module.exports = mongoose.model('Tournament', tournamentSchema);