const mongoose = require('mongoose');

const incomeAnalyticsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  day: { type: Number, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  coinWallet: {
    opening: { type: Number, default: 0 },
    recharge: { type: Number, default: 0 },
    reward: { type: Number, default: 0 },
    giftSent: { type: Number, default: 0 },
    giftReceived: { type: Number, default: 0 },
    exchangeIn: { type: Number, default: 0 },
    exchangeOut: { type: Number, default: 0 },
    adminAdjust: { type: Number, default: 0 },
    taskEarned: { type: Number, default: 0 },
    refund: { type: Number, default: 0 },
    closing: { type: Number, default: 0 },
    totalCredited: { type: Number, default: 0 },
    totalDebited: { type: Number, default: 0 }
  },
  diamondWallet: {
    opening: { type: Number, default: 0 },
    giftReceived: { type: Number, default: 0 },
    exchangeOut: { type: Number, default: 0 },
    withdrawal: { type: Number, default: 0 },
    adminAdjust: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    closing: { type: Number, default: 0 },
    totalCredited: { type: Number, default: 0 },
    totalDebited: { type: Number, default: 0 }
  },
  familyWallet: {
    opening: { type: Number, default: 0 },
    taskEarned: { type: Number, default: 0 },
    rewardEarned: { type: Number, default: 0 },
    contribution: { type: Number, default: 0 },
    closing: { type: Number, default: 0 }
  },
  agencyWallet: {
    opening: { type: Number, default: 0 },
    commissionEarned: { type: Number, default: 0 },
    hostEarnings: { type: Number, default: 0 },
    withdrawal: { type: Number, default: 0 },
    closing: { type: Number, default: 0 }
  },
  summary: {
    totalIncome: { type: Number, default: 0 },
    totalExpense: { type: Number, default: 0 },
    netChange: { type: Number, default: 0 },
    taxDeducted: { type: Number, default: 0 }
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

incomeAnalyticsSchema.index({ userId: 1, date: -1 });
incomeAnalyticsSchema.index({ userId: 1, year: -1, month: -1 });
incomeAnalyticsSchema.index({ userId: 1, year: -1, month: -1, day: -1 });

module.exports = mongoose.model('IncomeAnalytics', incomeAnalyticsSchema);