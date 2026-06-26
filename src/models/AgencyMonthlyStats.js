const mongoose = require('mongoose');

const agencyMonthlyStatsSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
  agencyName: { type: String, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  totalHostTargetCoins: { type: Number, default: 0 },
  totalHostEarningsDiamonds: { type: Number, default: 0 },
  totalHostEarningsCoins: { type: Number, default: 0 },
  ownerCommissionDiamonds: { type: Number, default: 0 },
  ownerCommissionCoins: { type: Number, default: 0 },
  activeHostsCount: { type: Number, default: 0 },
  totalGiftsReceived: { type: Number, default: 0 },
  totalWithdrawals: { type: Number, default: 0 },
  hostBreakdown: [{
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hostUid: { type: String, required: true },
    hostName: { type: String, required: true },
    targetCoins: { type: Number, default: 0 },
    earningsDiamonds: { type: Number, default: 0 },
    earningsCoins: { type: Number, default: 0 },
    commissionToOwner: { type: Number, default: 0 },
    giftsReceived: { type: Number, default: 0 },
    daysActive: { type: Number, default: 0 },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

agencyMonthlyStatsSchema.index({ agencyId: 1, year: -1, month: -1 }, { unique: true });

module.exports = mongoose.model('AgencyMonthlyStats', agencyMonthlyStatsSchema);