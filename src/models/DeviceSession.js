// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/DeviceSession.js
// ARVIND PARTY — Active Session & Device Management
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const deviceSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  uid: { type: String, required: true },
  sessionToken: { type: String, required: true, unique: true, index: true },
  deviceId: { type: String, required: true },
  deviceInfo: {
    platform: { type: String },
    userAgent: { type: String },
    appVersion: { type: String },
    deviceModel: { type: String },
    osVersion: { type: String },
  },
  ipAddress: { type: String },
  location: {
    country: { type: String },
    city: { type: String },
    region: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  loginAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  isActive: { type: Boolean, default: true },
  isTrusted: { type: Boolean, default: false },
  pushToken: { type: String },
  currentRoomId: { type: String },
  currentRoomName: { type: String },
  socketId: { type: String },
}, { timestamps: true });

deviceSessionSchema.index({ userId: 1, isActive: 1 });
deviceSessionSchema.index({ uid: 1, isActive: 1 });
deviceSessionSchema.index({ deviceId: 1 });
deviceSessionSchema.index({ sessionToken: 1 });

module.exports = mongoose.model('DeviceSession', deviceSessionSchema);