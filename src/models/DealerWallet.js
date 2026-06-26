const mongoose = require('mongoose');

const dealerWalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  uid: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  
  balance: { type: Number, default: 0 },
  totalReceived: { type: Number, default: 0 },
  totalTransferred: { type: Number, default: 0 },
  totalRefunded: { type: Number, default: 0 },
  
  level: { type: String, enum: ['silver', 'gold', 'diamond'], default: 'silver' },
  commissionPercent: { type: Number, default: 0 },
  bonusPercent: { type: Number, default: 0 },
  cgstPercent: { type: Number, default: 0 },
  sgstPercent: { type: Number, default: 0 },
  
  totalTransactions: { type: Number, default: 0 },
  totalCustomersServed: { type: Number, default: 0 },
  dailyTransferCount: { type: Number, default: 0 },
  lastTransferDate: { type: Date },
  
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  
  bulkStockPurchases: { type: Number, default: 0 },
  bulkPurchaseVolume: { type: Number, default: 0 },
  
  maxTransferPerTransaction: { type: Number, default: 50000 },
  dailyTransferLimit: { type: Number, default: 500000 },
  currentDailyTransfer: { type: Number, default: 0 },
  
  suspiciousActivityCount: { type: Number, default: 0 },
  isFlagged: { type: Boolean, default: false },
  flagReason: { type: String },
  flaggedAt: { type: Date },
  
  notes: { type: String, default: '' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date, default: Date.now },
}, { timestamps: true });

dealerWalletSchema.index({ userId: 1 });
dealerWalletSchema.index({ uid: 1 });
dealerWalletSchema.index({ level: 1 });
dealerWalletSchema.index({ isFlagged: 1 });

module.exports = mongoose.model('DealerWallet', dealerWalletSchema);