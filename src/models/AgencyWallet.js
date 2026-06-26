const mongoose = require('mongoose');

const agencyWalletSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true, unique: true },
  balance: { type: Number, default: 0 }, // agency commission earnings
  pendingWithdrawal: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  currency: { type: String, enum: ['coins', 'diamonds'], default: 'coins' },
  settlementRate: { type: Number, default: 0.08 }, // coins to cash rate
  autoSettlementEnabled: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('AgencyWallet', agencyWalletSchema);