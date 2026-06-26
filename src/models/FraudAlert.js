// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/FraudAlert.js
// ARVIND PARTY — Financial Fraud Alert Model
// Created when suspicious financial activity is detected.
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const fraudAlertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  uid: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: [
      'FAKE_RECHARGE',          // Client claimed payment success without server verification
      'ABNORMAL_COIN_TRANSFER', // Abnormally large or rapid coin transfers
      'RAPID_GIFTING',          // Gift spam / coin laundering pattern
      'MULTI_WALLET_DRAIN',     // Draining multiple wallets to one account
      'PLAY_STORE_FAKE_RECEIPT', // Invalid/duplicate Google Play receipt
      'THIRD_PARTY_CHEAT_TOOL', // Game timing anomaly suggesting bot
      'SELF_GIFT_LOOP',         // Gifting between own accounts
    ],
  },
  description: { type: String, required: true },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'HIGH',
  },
  status: {
    type: String,
    enum: ['OPEN', 'INVESTIGATING', 'RESOLVED_FRAUD', 'RESOLVED_FALSE_POSITIVE', 'ACCOUNT_HELD'],
    default: 'OPEN',
  },
  // Financial context
  amountInvolved: { type: Number, default: 0 }, // In coins
  transactionIds: [{ type: String }],
  // Account hold
  accountHeld: { type: Boolean, default: false },
  heldAt: { type: Date },
  heldUntil: { type: Date },
  // Resolution
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolutionNote: { type: String },
  // Metadata
  ipAddress: { type: String },
  deviceId: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  // Notifications
  financeManagerNotified: { type: Boolean, default: false },
  notifiedAt: { type: Date },
}, { timestamps: true });

fraudAlertSchema.index({ status: 1, createdAt: -1 });
fraudAlertSchema.index({ userId: 1, type: 1 });
fraudAlertSchema.index({ severity: 1, status: 1 });

module.exports = mongoose.model('FraudAlert', fraudAlertSchema);
