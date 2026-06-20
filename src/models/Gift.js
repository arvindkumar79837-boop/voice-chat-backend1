const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String },
  animationUrl: { type: String },
  coinCost: { type: Number, required: true }, // Cost to sender in COINS
  diamondValue: { type: Number, required: true }, // Value to receiver in DIAMONDS
  category: { type: String, enum: ['BASIC', 'PREMIUM', 'LUXURY', 'EXCLUSIVE'], default: 'BASIC' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Gift', giftSchema);
