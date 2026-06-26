// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/LoginHistory.js
// ARVIND PARTY — Login History & Suspicious Activity Tracker
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  uid: { type: String, required: true },
  loginAt: { type: Date, default: Date.now, index: true },
  logoutAt: { type: Date },
  ipAddress: { type: String },
  location: {
    country: { type: String },
    city: { type: String },
    region: { type: String },
  },
  deviceInfo: {
    deviceId: { type: String },
    platform: { type: String },
    userAgent: { type: String },
    appVersion: { type: String },
  },
  loginType: {
    type: String,
    enum: ['phone_otp', 'email', 'google', 'apple', 'facebook', 'snapchat', 'instagram', 'guest'],
    required: true,
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'suspicious', 'blocked'],
    default: 'success',
  },
  isNewDevice: { type: Boolean, default: false },
  isNewLocation: { type: Boolean, default: false },
  suspiciousReason: { type: String },
  sessionExpiresAt: { type: Date },
  sessionActive: { type: Boolean, default: true },
  socketId: { type: String },
}, { timestamps: true });

loginHistorySchema.index({ userId: 1, loginAt: -1 });
loginHistorySchema.index({ uid: 1, loginAt: -1 });
loginHistorySchema.index({ ipAddress: 1 });

module.exports = mongoose.model('LoginHistory', loginHistorySchema);