const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    default: () => `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walletType: {
    type: String,
    enum: ['coin', 'diamond', 'family', 'agency'],
    required: true
  },
  type: {
    type: String,
    enum: [
      'recharge', 'gift_sent', 'gift_received', 'withdrawal',
      'exchange_in', 'exchange_out', 'reward', 'bonus',
      'admin_adjust', 'refund', 'family_task_reward', 'family_contribution',
      'agency_commission', 'agency_host_earning', 'agency_withdrawal',
      'daily_task_reward', 'login_streak_reward', 'event_reward',
      'treasure_hunt_reward', 'lucky_draw_reward', 'tournament_reward',
      'penalty', 'tax_deducted', 'freeze_adjustment', 'unfreeze_adjustment'
    ],
    required: true
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  amountInr: { type: Number },
  balanceBefore: { type: Number },
  balanceAfter: { type: Number },
  description: { type: String, required: true },
  referenceId: { type: String },
  orderId: { type: String },
  paymentId: { type: String },
  signature: { type: String },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  giftId: { type: String },
  giftName: { type: String },
  quantity: { type: Number, default: 1 },
  packageId: { type: String },
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
  commissionRate: { type: Number },
  taxPercentage: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'reversed'],
    default: 'completed'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: { type: String },
  deviceInfo: {
    platform: { type: String },
    userAgent: { type: String },
    appVersion: { type: String }
  }
}, { timestamps: true });

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ walletType: 1, type: 1 });
walletTransactionSchema.index({ referenceId: 1 });
walletTransactionSchema.index({ status: 1 });
walletTransactionSchema.index({ familyId: 1, createdAt: -1 });
walletTransactionSchema.index({ agencyId: 1, createdAt: -1 });
walletTransactionSchema.index({ 'metadata.incomeDate': 1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);