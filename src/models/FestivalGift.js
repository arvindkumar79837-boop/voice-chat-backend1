const mongoose = require('mongoose');

const festivalGiftSchema = new mongoose.Schema({
  gift_name: { type: String, required: true },
  festival_name: { type: String, required: true },
  festival_type: {
    type: String,
    enum: ['DIWALI', 'EID', 'NEW_YEAR', 'HOLI', 'CHRISTMAS', 'CUSTOM'],
    required: true
  },
  gift_id: { type: String, required: true, unique: true },
  coin_value: { type: Number, default: 0 },
  diamond_value: { type: Number, default: 0 },
  xp_value: { type: Number, default: 0 },
  special_effect: { type: String, default: '' },
  is_limited: { type: Boolean, default: false },
  available_from: { type: Date, required: true },
  available_until: { type: Date, required: true },
  max_per_user: { type: Number, default: 0 },
  animation_url: { type: String, default: '' },
  icon_url: { type: String, default: '' },
  color_theme: { type: String, default: '#FFD700' },
  is_active: { type: Boolean, default: true },
  metadata: {
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
    drop_rate: { type: Number, default: 100 }
  }
}, { timestamps: true });

festivalGiftSchema.index({ festival_type: 1, is_active: 1, available_from: 1, available_until: 1 });
festivalGiftSchema.index({ gift_id: 1 });
festivalGiftSchema.index({ is_limited: 1 });

module.exports = mongoose.model('FestivalGift', festivalGiftSchema);