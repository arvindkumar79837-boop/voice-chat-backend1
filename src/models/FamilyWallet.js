const mongoose = require('mongoose');

const familyWalletSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true, unique: true },
  totalCoins: { type: Number, default: 0, min: 0 },
  totalDiamonds: { type: Number, default: 0, min: 0 },
  taskCoinsEarned: { type: Number, default: 0 },
  taskCoinsSpent: { type: Number, default: 0 },
  rewardCoins: { type: Number, default: 0 },
  memberContributions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uid: { type: String },
    coinsContributed: { type: Number, default: 0 },
    diamondsContributed: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    lastContributedAt: { type: Date }
  }],
  weeklyEarned: { type: Number, default: 0 },
  monthlyEarned: { type: Number, default: 0 },
  lastWeeklyReset: { type: Date, default: Date.now },
  lastMonthlyReset: { type: Date, default: Date.now },
  isFrozen: { type: Boolean, default: false },
  frozenAt: { type: Date },
  frozenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  freezeReason: { type: String }
}, { timestamps: true });

familyWalletSchema.index({ familyId: 1 });
familyWalletSchema.index({ 'memberContributions.userId': 1 });
familyWalletSchema.index({ totalCoins: -1 });

module.exports = mongoose.model('FamilyWallet', familyWalletSchema);