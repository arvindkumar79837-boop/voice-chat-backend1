const mongoose = require('mongoose');

const salaryRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  baseSalary: { type: Number, default: 0 },
  targetBonus: { type: Number, default: 0 },
  attendanceBonus: { type: Number, default: 0 },
  giftCommission: { type: Number, default: 0 },
  penaltyDeduction: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  attendanceDays: { type: Number, default: 0 },
  attendanceMinutes: { type: Number, default: 0 },
  giftsReceived: { type: Number, default: 0 },
  hostLevel: { type: String, default: 'bronze' },
  targetAchieved: { type: Boolean, default: false },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  paidAt: { type: Date },
  notes: { type: String, default: '' },
}, { timestamps: true });

salaryRecordSchema.index({ userId: 1, month: -1, year: -1 }, { unique: true });

module.exports = mongoose.model('SalaryRecord', salaryRecordSchema);