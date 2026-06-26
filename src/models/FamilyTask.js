const mongoose = require('mongoose');

const familyTaskSchema = new mongoose.Schema({
  familyId: { type: String, required: true },
  taskType: { type: String, required: true, enum: ['collective_gifting', 'live_hours', 'daily_active_members', 'special_event'] },
  description: { type: String, required: true },
  targetValue: { type: Number, required: true },
  currentProgress: { type: Number, default: 0 },
  rewardCoins: { type: Number, default: 0 },
  rewardXP: { type: Number, default: 0 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'expired'], default: 'pending' },
  isClaimed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('FamilyTask', familyTaskSchema);