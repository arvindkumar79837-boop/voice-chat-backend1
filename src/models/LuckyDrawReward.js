const mongoose = require('mongoose');

const luckyDrawRewardSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "100 Diamonds", "Ferrari Mount", "Try Again"
  type: { type: String, enum: ['coin', 'diamond', 'frame', 'badge', 'car', 'empty'], required: true },
  value: { type: Number, default: 0 },    // Number of coins/diamonds OR validity duration in days
  probability: { type: Number, required: true }, // Decimal between 0.0 to 1.0 (Sum of all should be exactly 1.0)
  image: { type: String, default: '' },
  itemId: { type: String, default: null }, // If frame or car, map to the specific Item ID
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

luckyDrawRewardSchema.index({ isActive: 1 });

module.exports = mongoose.model('LuckyDrawReward', luckyDrawRewardSchema);