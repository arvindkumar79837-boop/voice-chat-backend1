const mongoose = require('mongoose');

const subscriptionPurchaseLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purchaseToken: { type: String, required: true, unique: true },
  productId: { type: String, required: true },
  tierId: { type: mongoose.Schema.Types.ObjectId, ref: 'PremiumSubscription', required: true },
  orderId: { type: String, default: '' },
  expiresAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED'],
    default: 'ACTIVE'
  },
  verificationResponse: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

subscriptionPurchaseLogSchema.index({ purchaseToken: 1 });
subscriptionPurchaseLogSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('SubscriptionPurchaseLog', subscriptionPurchaseLogSchema);
