const mongoose = require('mongoose');

const frameSchema = new mongoose.Schema({
  name: { type: String, required: true },
  imageUrl: { type: String, required: true }, // Frame ki transparent PNG image
  priceCoins: { type: Number, required: true, default: 100 },
  validityDays: { type: Number, default: 30 }, // Kitne din tak chalega
  levelRequired: { type: Number, default: 1 }, // Optional: Level restriction
  isVipOnly: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Frame', frameSchema);