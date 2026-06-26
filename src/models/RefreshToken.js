// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/RefreshToken.js
// ARVIND PARTY — Refresh Token Persistence
// Allows server-side revocation of stolen refresh tokens.
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  uid: { type: String, required: true },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  deviceId: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  isRevoked: { type: Boolean, default: false },
  revokedAt: { type: Date },
  revokedReason: { type: String },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // MongoDB TTL — auto-deletes after expiresAt
  },
}, { timestamps: true });

refreshTokenSchema.index({ userId: 1, isRevoked: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
