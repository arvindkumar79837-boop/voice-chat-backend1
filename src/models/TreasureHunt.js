const mongoose = require('mongoose');

const treasureHuntSchema = new mongoose.Schema({
  hunt_name: { type: String, required: true },
  description: { type: String, required: true },
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  room_id: { type: String, required: true },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  is_active: { type: Boolean, default: true },
  is_found: { type: Boolean, default: false },
  found_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  found_at: { type: Date },
  keys_required: { type: Number, default: 5 },
  keys_collected: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  keys_collected_count: { type: Number, default: 0 },
  rewards: {
    coins: { type: Number, default: 0 },
    diamonds: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    frames: [{ type: String }],
    badges: [{ type: String }],
    cars: [{ type: String }],
    specialEffects: [{ type: String }]
  },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
  max_finders: { type: Number, default: 1 },
  metadata: {
    location_x: { type: Number, default: 0 },
    location_y: { type: Number, default: 0 },
    treasure_type: { type: String, default: 'normal' },
    rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'rare' }
  }
}, { timestamps: true });

treasureHuntSchema.index({ room_id: 1, is_active: 1 });
treasureHuntSchema.index({ event_id: 1 });
treasureHuntSchema.index({ status: 1, end_time: -1 });

module.exports = mongoose.model('TreasureHunt', treasureHuntSchema);