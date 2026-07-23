// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/TwoFactorSession.js
// ARVIND PARTY — Server-side 2FA Verification Sessions
// Prevents header-spoofing bypass of require2FA middleware
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const TwoFactorSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    required: true,
  },
  ipAddress: { type: String },
  userAgent: { type: String },
});

TwoFactorSessionSchema.index({ userId: 1 });
TwoFactorSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-delete

module.exports = mongoose.model('TwoFactorSession', TwoFactorSessionSchema);
