const mongoose = require('mongoose');

const revenueSummarySchema = new mongoose.Schema({
  summaryId: {
    type: String,
    default: 'main_summary',
    unique: true,
    index: true
  },
  totalRevenue: { type: Number, default: 0 },
  todayRevenue: { type: Number, default: 0 },
  thisWeekRevenue: { type: Number, default: 0 },
  thisMonthRevenue: { type: Number, default: 0 },
  totalPayouts: { type: Number, default: 0 },
  pendingWithdrawalsAmount: { type: Number, default: 0 },
  totalDiamondsEarned: { type: Number, default: 0 },
  todayDiamondsEarned: { type: Number, default: 0 },
  thisWeekDiamondsEarned: { type: Number, default: 0 },
  thisMonthDiamondsEarned: { type: Number, default: 0 },
  activeRechargeUsers: { type: Number, default: 0 },
  coinSellerTotalSales: { type: Number, default: 0 },
  totalCommissionPaid: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

revenueSummarySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

revenueSummarySchema.index({ lastUpdated: -1 });

module.exports = mongoose.model('RevenueSummary', revenueSummarySchema);