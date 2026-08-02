const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  googlePlayPurchaseToken: { // For Google Play Billing verification
    type: String,
    required: false,
    index: true,
  },
  orderId: { // Internal or Google-provided order ID
    type: String,
    required: false,
    index: true,
  },
  amount: {
    type: Number, // In subunits (e.g., paise)
    required: true
  },
  type: {
    type: String,
    default: 'COIN_PURCHASE'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  }
}, { timestamps: true });


// ─── Compound Indexes (P1-2) ─────────────────────────────────────────────
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);