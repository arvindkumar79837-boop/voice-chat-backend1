const mongoose = require('mongoose');

const blindDateSessionSchema = new mongoose.Schema({
  userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['WAITING', 'ACTIVE', 'REVEAL_PENDING', 'MATCHED', 'ENDED_NO_MATCH', 'ENDED_REPORTED'],
    default: 'WAITING',
  },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  revealTimerSeconds: { type: Number, default: 120 },
  userADecision: { type: String, enum: ['PENDING', 'INTERESTED', 'PASS'], default: 'PENDING' },
  userBDecision: { type: String, enum: ['PENDING', 'INTERESTED', 'PASS'], default: 'PENDING' },
  icebreakerPromptId: { type: mongoose.Schema.Types.ObjectId, ref: 'IcebreakerPrompt', default: null },
  liveKitRoomId: { type: String, default: '' },
  coinsCharged: { type: Number, default: 0 },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reportReason: { type: String, default: '' },
}, { timestamps: true });

blindDateSessionSchema.index({ userA: 1, status: 1 });
blindDateSessionSchema.index({ userB: 1, status: 1 });
blindDateSessionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('BlindDateSession', blindDateSessionSchema);
