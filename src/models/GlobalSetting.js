const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    giftCommission: { type: Number, default: 30 }, // Platform commission %
    withdrawalFee: { type: Number, default: 5 },   // Fee in %
    minWithdrawal: { type: Number, default: 100 }, // Minimum amount
  },
  { timestamps: true }
);

module.exports = mongoose.model('GlobalSetting', settingSchema);