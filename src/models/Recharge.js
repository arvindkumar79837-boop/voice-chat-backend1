const mongoose = require('mongoose');

const rechargeSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, // Internal order ID
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uid: { type: String, required: true },

  // Amount
  amountINR: { type: Number, required: true },  // Actual INR paid
  coinsToCredit: { type: Number, required: true }, // Coins user gets

  // Package info
  packageId: { type: String },
  packageName: { type: String },

  // Gateway
  gateway: {
    type: String,
    enum: ['RAZORPAY', 'CASHFREE', 'PAYTM', 'PHONEPAY', 'GOOGLEPAY', 'UPI'],
    required: true
  },
  gatewayOrderId: { type: String, unique: true, sparse: true },
  gatewayPaymentId: { type: String, sparse: true },
  gatewaySignature: { type: String },

  // Status
  status: {
    type: String,
    enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
    default: 'CREATED'
  },

  // ⚠️ NEVER trust client-sent payment success
  // Only set to SUCCESS after server-side gateway verification
  verifiedByServer: { type: Boolean, default: false },
  verifiedAt: { type: Date },

  // Coins credited
  coinsCredited: { type: Boolean, default: false },
  creditedAt: { type: Date },
  transactionId: { type: String }, // Links to WalletTransaction

  // Security
  ipAddress: { type: String },
  deviceId: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

rechargeSchema.index({ userId: 1, createdAt: -1 });
rechargeSchema.index({ gatewayOrderId: 1 });
rechargeSchema.index({ status: 1 });

module.exports = mongoose.model('Recharge', rechargeSchema);
