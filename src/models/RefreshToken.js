// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/RefreshToken.js
// ARVIND PARTY — Refresh Token Store (for rotation + reuse detection)
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  replacedBy: { type: String, default: null }, // New token that replaced this
  createdAt: { type: Date, default: Date.now },
});

RefreshTokenSchema.index({ token: 1 }, { unique: true });
RefreshTokenSchema.index({ userId: 1, createdAt: -1 });
// Auto-delete expired tokens after 35 days
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
