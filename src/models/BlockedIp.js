// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/BlockedIp.js
// ARVIND PARTY — Blocked IP Address Model
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const blockedIpSchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  reason: { type: String, required: true },
  blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isVpnBlock: { type: Boolean, default: false }, // Auto-blocked by VPN detection
  isPermanent: { type: Boolean, default: false },
  expiresAt: { type: Date }, // null = permanent
  country: { type: String },
  isp: { type: String },
}, { timestamps: true });

blockedIpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL for temp bans

module.exports = mongoose.model('BlockedIp', blockedIpSchema);
