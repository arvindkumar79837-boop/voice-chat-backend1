const mongoose = require('mongoose');

const familyWarSchema = new mongoose.Schema({
  war_id: { type: String, required: true, unique: true },
  war_type: { type: String, required: true, enum: ['pk_battle', 'weekly_war', 'monthly_war', 'special_event'] },
  family_1_id: { type: String, required: true },
  family_1_name: { type: String, required: true },
  family_2_id: { type: String, required: true },
  family_2_name: { type: String, required: true },
  status: { type: String, enum: ['scheduled', 'active', 'completed', 'cancelled'], default: 'scheduled' },
  start_time: { type: Date, required: true },
  end_time: { type: Date },
  family_1_points: { type: Number, default: 0 },
  family_2_points: { type: Number, default: 0 },
  winner_family_id: { type: String },
  winning_margin: { type: Number },
  participants_family_1: [{ type: String }],
  participants_family_2: [{ type: String }],
  created_by: { type: String, required: true },
  created_by_role: { type: String, required: true, enum: ['owner', 'admin', 'family_owner'] },
  rewards_distributed: { type: Boolean, default: false },
  total_gifts_sent: { type: Number, default: 0 },
  total_viewers: { type: Number, default: 0 }
}, { timestamps: true });

familyWarSchema.index({ war_id: 1 });
familyWarSchema.index({ war_type: 1, status: 1 });
familyWarSchema.index({ start_time: -1 });

module.exports = mongoose.model('FamilyWar', familyWarSchema);