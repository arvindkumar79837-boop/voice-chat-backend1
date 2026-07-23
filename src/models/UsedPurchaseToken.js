// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/UsedPurchaseToken.js
// ARVIND PARTY — IAP Token Replay Prevention
// Prevents same Google Play purchase token from being used more than once
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const UsedPurchaseTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: String },
  packageName: { type: String },
  coinsAwarded: { type: Number, default: 0 },
  usedAt: { type: Date, default: Date.now },
});

UsedPurchaseTokenSchema.index({ token: 1 }, { unique: true });
UsedPurchaseTokenSchema.index({ userId: 1, usedAt: -1 });

module.exports = mongoose.model('UsedPurchaseToken', UsedPurchaseTokenSchema);
