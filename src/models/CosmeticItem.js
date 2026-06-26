const mongoose = require('mongoose');

const CosmeticItemSchema = new mongoose.Schema({
  item_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  item_type: {
    type: String,
    required: true,
    enum: ['frame', 'entrance_car', 'name_color', 'chat_bubble', 'badge', 'emote', 'gift'],
    default: 'frame'
  },
  item_name: String,
  description: String,
  image_url: String,
  animation_url: String,
  animation_duration_ms: { type: Number, default: 3000 },
  // Pricing
  coin_cost: { type: Number, default: 0 },
  vip_level_required: { type: Number, default: 0, min: 0, max: 15 },
  svip_level_required: { type: Number, default: 0, min: 0, max: 5 },
  is_premium_exclusive: { type: Boolean, default: false },
  is_svip_exclusive: { type: Boolean, default: false },
  // Display
  is_animated: { type: Boolean, default: false },
  is_gradient: { type: Boolean, default: false },
  hex_code: String,
  gradient_colors: [String],
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary', 'godly'],
    default: 'common'
  },
  // Availability
  is_active: { type: Boolean, default: true },
  is_limited_edition: { type: Boolean, default: false },
  limited_edition_quantity: { type: Number, default: 0 },
  limited_edition_sold: { type: Number, default: 0 },
  available_from: Date,
  available_until: Date,
  // Sort order
  display_order: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

CosmeticItemSchema.index({ item_type: 1, is_active: 1 });
CosmeticItemSchema.index({ rarity: 1 });
CosmeticItemSchema.index({ vip_level_required: 1 });

module.exports = mongoose.model('CosmeticItem', CosmeticItemSchema);