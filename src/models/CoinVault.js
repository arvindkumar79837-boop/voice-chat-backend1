// ═══════════════════════════════════════════════════════════════════════════
// MODEL: CoinVault — Global coin vault (Owner-only minting)
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const coinVaultSchema = new mongoose.Schema(
  {
    totalCoinsMinted: { type: Number, default: 0 },
    totalCoinsDispatched: { type: Number, default: 0 },
    totalCoinsBurned: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    lastMintDate: { type: Date },
    lastDispatchDate: { type: Date },
    mintHistory: [
      {
        amount: { type: Number, required: true },
        reason: { type: String, default: '' },
        mintedBy: { type: String, required: true },
        mintedAt: { type: Date, default: Date.now },
      },
    ],
    dispatchHistory: [
      {
        amount: { type: Number, required: true },
        targetSellerUid: { type: String, required: true },
        dispatchedBy: { type: String, required: true },
        dispatchedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'completed' },
      },
    ],
    burnHistory: [
      {
        amount: { type: Number, required: true },
        reason: { type: String, default: '' },
        burnedBy: { type: String, required: true },
        burnedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Ensure only one vault document exists (singleton pattern)
coinVaultSchema.statics.getVault = async function () {
  let vault = await this.findOne();
  if (!vault) {
    vault = await this.create({
      totalCoinsMinted: 0,
      totalCoinsDispatched: 0,
      totalCoinsBurned: 0,
      currentBalance: 0,
    });
  }
  return vault;
};

module.exports = mongoose.model('CoinVault', coinVaultSchema);