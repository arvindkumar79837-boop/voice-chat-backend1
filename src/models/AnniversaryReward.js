const mongoose = require('mongoose');

const anniversaryRewardSchema = new mongoose.Schema({
  reward_name: { type: String, required: true },
  year_anniversary: { type: Number, required: true },
  category: {
    type: String,
    enum: ['top_sender', 'top_receiver', 'top_streamer', 'top_family', 'special_achievement', 'participation'],
    required: true
  },
  rank_position: { type: Number, default: 0 },
  reward_type: {
    type: String,
    enum: ['cash', 'coins', 'diamonds', 'badge', 'frame', 'vip_days', 'special_title', 'real_world_prize'],
    required: true
  },
  reward_value: { type: Number, default: 0 },
  reward_details: {
    currency: { type: String, default: 'INR' },
    item_id: { type: String, default: '' },
    description: { type: String, default: '' },
    image_url: { type: String, default: '' }
  },
  criteria: {
    min_gift_value: { type: Number, default: 0 },
    min_received_value: { type: Number, default: 0 },
    min_stream_hours: { type: Number, default: 0 },
    min_family_points: { type: Number, default: 0 },
    requirement_description: { type: String, default: '' }
  },
  is_active: { type: Boolean, default: true },
  is_paid_out: { type: Boolean, default: false },
  paid_out_at: { type: Date },
  winner_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: {
    anniversary_event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    verification_status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    payment_reference: { type: String, default: '' },
    notes: { type: String, default: '' }
  }
}, { timestamps: true });

anniversaryRewardSchema.index({ year_anniversary: 1, category: 1, rank_position: 1 });
anniversaryRewardSchema.index({ winner_user_id: 1 });
anniversaryRewardSchema.index({ 'metadata.anniversary_event_id': 1 });
anniversaryRewardSchema.index({ is_paid_out: 1 });

module.exports = mongoose.model('AnniversaryReward', anniversaryRewardSchema);