const mongoose = require('mongoose');

const agencyAnalyticSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
  agencyName: { type: String, required: true },
  agencyOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalDiamondsEarned: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  totalHosts: { type: Number, default: 0 },
  activeHosts: { type: Number, default: 0 },
  topHostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  topHostName: { type: String, default: '' },
  topHostDiamonds: { type: Number, default: 0 },
  totalWithdrawals: { type: Number, default: 0 },
  withdrawalAmount: { type: Number, default: 0 },
  commissionPaid: { type: Number, default: 0 },
  commissionEarned: { type: Number, default: 0 },
  totalRooms: { type: Number, default: 0 },
  activeRooms: { type: Number, default: 0 },
  rankingPosition: { type: Number, default: 0 },
  previousRankingPosition: { type: Number, default: 0 },
  trend: { type: String, enum: ['up', 'down', 'stable'], default: 'stable' },
  date: { type: Date, required: true, index: true }
}, { timestamps: true });

agencyAnalyticSchema.index({ agencyId: 1, date: -1 });
agencyAnalyticSchema.index({ totalDiamondsEarned: -1 });
agencyAnalyticSchema.index({ rankingPosition: 1 });
agencyAnalyticSchema.index({ date: -1 });

module.exports = mongoose.model('AgencyAnalytic', agencyAnalyticSchema);