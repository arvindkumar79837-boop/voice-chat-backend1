const mongoose = require('mongoose');

const familyShopItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ['profile_frame', 'chat_bubble', 'entry_car', 'badge'], required: true },
  cost: { type: Number, required: true, min: 0 },
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  imageUrl: { type: String },
  isActive: { type: Boolean, default: true },
  stock: { type: Number, default: -1 },
  requirements: {
    minFamilyLevel: { type: Number, default: 1 },
    minUserLevel: { type: Number, default: 1 }
  }
}, { timestamps: true });

familyShopItemSchema.index({ type: 1, isActive: 1 });
familyShopItemSchema.index({ rarity: 1 });

module.exports = mongoose.model('FamilyShopItem', familyShopItemSchema);