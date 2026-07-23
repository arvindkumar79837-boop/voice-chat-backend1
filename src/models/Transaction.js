const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  razorpayOrderId: {
    type: String,
    required: false
  },
  razorpayPaymentId: {
    type: String,
    required: false
  },
  amount: {
    type: Number, // In subunits (e.g., paise)
    required: true
  },
  type: {
    type: String,
    default: 'VIP_UPGRADE'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'SUCCESS', 'FAILED', 'PENDING'],
    default: 'SUCCESS'
  }
}, { timestamps: true });


// ─── Compound Indexes (P1-2) ─────────────────────────────────────────────
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ razorpayPaymentId: 1 }, { sparse: true });

module.exports = mongoose.model('Transaction', transactionSchema);