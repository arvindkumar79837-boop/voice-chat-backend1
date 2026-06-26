// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/TwoFactorAuth.js
// ARVIND PARTY — Two-Factor Authentication & Backup Codes
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const twoFactorAuthSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  uid: { type: String, required: true, unique: true },
  isEnabled: { type: Boolean, default: false },
  method: {
    type: String,
    enum: ['totp', 'sms_otp', 'email_otp'],
    default: 'totp',
  },
  totpSecret: { type: String },
  totpQrCode: { type: String },
  phone: { type: String },
  email: { type: String },
  backupCodes: [{
    code: { type: String, required: true },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  }],
  lastVerifiedAt: { type: Date },
  failedAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  recoveryEmail: { type: String },
  recoveryPhone: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('TwoFactorAuth', twoFactorAuthSchema);