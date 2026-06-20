const mongoose = require('mongoose');

const treasuryLogSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    generatedBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true } // Creates createdAt and updatedAt automatically
);

module.exports = mongoose.model('TreasuryLog', treasuryLogSchema);