const mongoose = require('mongoose');

const penaltySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // agency owner/manager
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  reason: { type: String, required: true },
  type: { type: String, enum: ['coins', 'salary', 'both'], default: 'coins' },
  amount: { type: Number, required: true, min: 0 },
  isPercentage: { type: Boolean, default: false },
  appliedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, { timestamps: true });

penaltySchema.index({ userId: 1, month: -1, year: -1 });

module.exports = mongoose.model('Penalty', penaltySchema);