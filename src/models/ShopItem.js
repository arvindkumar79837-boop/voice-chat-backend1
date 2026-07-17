const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['frame', 'mount', 'bubble', 'badge', 'entrance_car', 'name_color', 'emote', 'gift'],
  },
  priceDiamonds: { type: Number, required: true },
  durationDays: { type: Number, default: 7 },
  imageUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
}, { timestamps: true });

shopItemSchema.index({ type: 1, isActive: 1 });
shopItemSchema.index({ displayOrder: 1 });

module.exports = mongoose.model('ShopItem', shopItemSchema);
