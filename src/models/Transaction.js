const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  razorpayPaymentId: {
    type: String,
    required: true
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
    enum: ['SUCCESS', 'FAILED', 'PENDING'],
    default: 'SUCCESS'
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);