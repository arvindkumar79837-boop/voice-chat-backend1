const mongoose = require('mongoose');

const walletConfigSchema = new mongoose.Schema({
  configKey: {
    type: String,
    unique: true,
    required: true
  },
  configValue: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

walletConfigSchema.index({ configKey: 1 });

module.exports = mongoose.model('WalletConfig', walletConfigSchema);