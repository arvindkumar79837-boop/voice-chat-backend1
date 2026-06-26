const mongoose = require('mongoose');

const dealerRefundSchema = new mongoose.Schema({
  refundId: { type: String, required: true, unique: true },
  
  dealerWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'DealerWallet', required: true },
  dealerUid: { type: String, required: true },
  dealerUsername: { type: String, required: true },
  
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUid: { type: String, required: true },
  transactionHash: { type: String, required: true },
  
  coinsToRefund: { type: Number, required: true },
  reason: { type: String, required: true },
  errorDescription: { type: String },
  
  originalTransactionId: { type: String },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'refunded'],
    default: 'pending'
  },
  
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date },
  processingNotes: { type: String },
  
  coinsDebitedFromUser: { type: Boolean, default: false },
  coinsCreditedToDealer: { type: Boolean, default: false },
  
  transactionHashResp: { type: String, default: '' },
  
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

dealerRefundSchema.index({ refundId: 1 });
dealerRefundSchema.index({ dealerUid: 1 });
dealerRefundSchema.index({ status: 1 });
dealerRefundSchema.index({ transactionHash: 1 });
dealerRefundSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DealerRefund', dealerRefundSchema);