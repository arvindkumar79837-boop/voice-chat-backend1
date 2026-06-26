const mongoose = require('mongoose');

const familyAnalyticSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true, index: true },
  familyName: { type: String, required: true },
  familyOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalMembers: { type: Number, default: 0 },
  activeMembers: { type: Number, default: 0 },
  totalDiamondsEarned: { type: Number, default: 0 },
  totalDiamondsSpent: { type: Number, default: 0 },
  totalRoomsCreated: { type: Number, default: 0 },
  totalMessagesSent: { type: Number, default: 0 },
  totalGiftsSent: { type: Number, default: 0 },
  totalGiftsReceived: { type: Number, default: 0 },
  rankingPoints: { type: Number, default: 0 },
  rankingPosition: { type: Number, default: 0 },
  previousRankingPosition: { type: Number, default: 0 },
  trend: { type: String, enum: ['up', 'down', 'stable'], default: 'stable' },
  topContributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  topContributorName: { type: String, default: '' },
  topContributorDiamonds: { type: Number, default: 0 },
  date: { type: Date, required: true, index: true }
}, { timestamps: true });

familyAnalyticSchema.index({ familyId: 1, date: -1 });
familyAnalyticSchema.index({ rankingPoints: -1 });
familyAnalyticSchema.index({ rankingPosition: 1 });
familyAnalyticSchema.index({ date: -1 });

module.exports = mongoose.model('FamilyAnalytic', familyAnalyticSchema);