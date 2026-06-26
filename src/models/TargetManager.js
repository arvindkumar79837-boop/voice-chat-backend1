// ═══════════════════════════════════════════════════════════════════════════
// MODEL: TargetManager — Streamer performance targets & 50/50 revenue split
// Weekly, 15-Day, Monthly cycles
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const targetCycleSchema = new mongoose.Schema({
  cycleType: {
    type: String,
    enum: ['weekly', 'fifteen_day', 'monthly'],
    required: true,
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  targetDiamonds: { type: Number, required: true, default: 0 },
  targetCoins: { type: Number, default: 0 },
  targetGiftCount: { type: Number, default: 0 },
  targetLiveHours: { type: Number, default: 0 },
});

const targetManagerSchema = new mongoose.Schema(
  {
    streamerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    streamerUid: { type: String, required: true },
    cycle: targetCycleSchema,
    progress: {
      currentDiamonds: { type: Number, default: 0 },
      currentCoins: { type: Number, default: 0 },
      currentGiftCount: { type: Number, default: 0 },
      currentLiveHours: { type: Number, default: 0 },
      percentComplete: { type: Number, default: 0 },
    },
    isTargetMet: { type: Boolean, default: false },
    targetMetAt: { type: Date },
    settlement: {
      totalRevenue: { type: Number, default: 0 },
      platformShare: { type: Number, default: 0 },
      streamerShare: { type: Number, default: 0 },
      splitRatio: { type: Number, default: 50 }, // 50 = 50-50 split
      isSettled: { type: Boolean, default: false },
      settledAt: { type: Date },
      settlementTxId: { type: String },
    },
    diamondExchangeRequests: [
      {
        diamondAmount: { type: Number, required: true },
        coinAmount: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        requestedAt: { type: Date, default: Date.now },
        processedAt: { type: Date },
        processedBy: { type: String },
      },
    ],
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

targetManagerSchema.index({ streamerId: 1, 'cycle.cycleType': 1, 'cycle.startDate': -1 });
targetManagerSchema.index({ streamerUid: 1 });
targetManagerSchema.index({ isTargetMet: 1, 'settlement.isSettled': 1 });

// Auto-calculate percentComplete before save
targetManagerSchema.pre('save', function (next) {
  if (this.cycle.targetDiamonds > 0) {
    this.progress.percentComplete = Math.min(
      100,
      Math.round((this.progress.currentDiamonds / this.cycle.targetDiamonds) * 100)
    );
  }
  if (this.progress.percentComplete >= 100 && !this.isTargetMet) {
    this.isTargetMet = true;
    this.targetMetAt = new Date();
  }
  next();
});

module.exports = mongoose.model('TargetManager', targetManagerSchema);