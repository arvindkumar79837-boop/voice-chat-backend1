// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/SpamLog.js
// ARVIND PARTY — Anti-Spam / Anti-Abuse Log Model
// Tracks spam events; auto-expires after 90 days to save space.
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const spamLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  uid: { type: String, index: true },
  roomId: { type: String },
  type: {
    type: String,
    required: true,
    enum: [
      'REPEATED_MESSAGE',    // Same message pasted multiple times
      'PROFANITY_DETECTED',  // AI filter caught abusive language
      'RAPID_FIRE_MESSAGES', // Too many messages per second
      'GAME_CHEAT_ATTEMPT',  // Abnormal click timing in games
      'FAKE_GIFT_REPLAY',    // Replay attack on gift socket
      'ABNORMAL_TRANSFER',   // Coin transfer anomaly
      'MULTI_ACCOUNT_SAME_DEVICE', // Multiple accounts on one device
    ],
  },
  details: { type: String },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
  autoAction: { type: String }, // e.g. 'MUTED_5MIN', 'CHAT_BLOCKED', 'ACCOUNT_HOLD'
  ipAddress: { type: String },
  deviceId: { type: String },
  messageContent: { type: String }, // Snippet of offending message (max 200 chars)
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolution: { type: String },
}, {
  timestamps: true,
});

// Auto-delete after 90 days
spamLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
spamLogSchema.index({ userId: 1, createdAt: -1 });
spamLogSchema.index({ type: 1 });
spamLogSchema.index({ severity: 1 });

module.exports = mongoose.model('SpamLog', spamLogSchema);
