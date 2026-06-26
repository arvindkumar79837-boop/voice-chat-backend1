const mongoose = require('mongoose');

const familyLeaderboardSchema = new mongoose.Schema({
  familyId: { type: String, required: true, index: true },
  uid: { type: String, required: true, index: true },
  username: { type: String, default: '' },
  avatar: { type: String, default: '' },
  totalContribution: { type: Number, default: 0 },
  totalCoinsGifted: { type: Number, default: 0 },
  totalXPEarned: { type: Number, default: 0 },
  rank: { type: Number, default: 0 },
  period: {
    type: String,
    enum: ['all_time', 'monthly', 'weekly', 'daily'],
    default: 'all_time'
  },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

familyLeaderboardSchema.index({ familyId: 1, period: 1, rank: 1 });
familyLeaderboardSchema.index({ familyId: 1, uid: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('FamilyLeaderboard', familyLeaderboardSchema);