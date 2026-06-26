const mongoose = require('mongoose');

const monthlyReportSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  totalHosts: { type: Number, default: 0 },
  totalActiveHosts: { type: Number, default: 0 },
  totalAttendanceDays: { type: Number, default: 0 },
  totalGiftsReceived: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  totalSalaryPaid: { type: Number, default: 0 },
  agencyCommissionEarned: { type: Number, default: 0 },
  totalPenalties: { type: Number, default: 0 },
  totalBonuses: { type: Number, default: 0 },
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: String, default: 'cron' },
}, { timestamps: true });

monthlyReportSchema.index({ agencyId: 1, month: -1, year: -1 }, { unique: true });

module.exports = mongoose.model('MonthlyReport', monthlyReportSchema);