// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/BannedDevice.js
// ARVIND PARTY - BANNED DEVICE MODEL
// Stores device IDs (IMEI/UUID) that are permanently blocked from the platform.
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const bannedDeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  reason: {
    type: String,
    required: true,
    default: 'Repeated violation of platform policies.',
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
  },
  bannedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('BannedDevice', bannedDeviceSchema);