const mongoose = require('mongoose');

const diamondWithdrawalRequestSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
  },
  diamondsRequested: {
    type: Number,
    required: true,
    min: 1,
  },
  payoutRatioAtRequest: {
    type: Number,
    required: true,
  },
  payoutAmount: {
    type: Number,
    required: true,
  },
  payoutCurrencyLabel: {
    type: String,
    default: 'INR',
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'PAID', 'REJECTED'],
    default: 'PENDING',
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: Date,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
  notificationClearedByRequester: {
    type: Boolean,
    default: false,
  },
  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

diamondWithdrawalRequestSchema.index({ staffId: 1, status: 1 });
diamondWithdrawalRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('DiamondWithdrawalRequest', diamondWithdrawalRequestSchema);
