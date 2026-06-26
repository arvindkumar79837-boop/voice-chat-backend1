const mongoose = require('mongoose');

const bonusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  awardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // agency owner/manager
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  reason: { type: String, required: true },
  type: { type: String, enum: ['coins', 'vip_tag', 'badge'], default: 'coins' },
  amount: { type: Number, default: 0 },
  vipTag: { type: String, default: '' },
  badgeId: { type: String, default: '' },
  awardedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, { timestamps: true });

bonusSchema.index({ userId: 1, month: -1, year: -1 });

module.exports = mongoose.model('Bonus', bonusSchema);