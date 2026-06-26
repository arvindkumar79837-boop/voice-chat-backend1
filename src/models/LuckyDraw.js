const mongoose = require('mongoose');

const luckyDrawSchema = new mongoose.Schema({
  draw_name: { type: String, required: true },
  description: { type: String, default: '' },
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  spin_cost_coins: { type: Number, default: 100 },
  spin_cost_diamonds: { type: Number, default: 0 },
  max_spins_per_user: { type: Number, default: 10 },
  total_spins_allowed: { type: Number, default: 1000 },
  spins_used: { type: Number, default: 0 },
  
  // Wheel segments (array of prize options)
  segments: [{
    label: { type: String, required: true },
    prize_type: { 
      type: String, 
      enum: ['coins', 'diamonds', 'xp', 'frame', 'badge', 'rocket', 'vip_days', 'jackpot', 'entry_car', 'nothing'],
      required: true 
    },
    prize_value: { type: Number, default: 0 },         // For numeric prizes
    prize_id: { type: String, default: '' },            // For frame/badge/car IDs
    prize_name: { type: String, default: '' },           // Display name
    weight: { type: Number, default: 10 },               // Probability weight (higher = more likely)
    color: { type: String, default: '#FF6B6B' }          // Segment color on spinner
  }],
  
  // Jackpot specific
  jackpot_enabled: { type: Boolean, default: false },
  jackpot_prize: {
    prize_type: { type: String, default: 'jackpot_coins' },
    prize_value: { type: Number, default: 10000 },
    prize_name: { type: String, default: 'JACKPOT' }
  },
  jackpot_current_pool: { type: Number, default: 0 },
  jackpot_trigger_rate: { type: Number, default: 0.01 }, // 1% chance

  is_active: { type: Boolean, default: true },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },

  // Tracking
  total_spins: { type: Number, default: 0 },
  total_users_played: { type: Number, default: 0 },
  unique_users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // User spin history (last 1000 spins tracked in array, rest in separate collection)
  recent_wins: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    prize_label: { type: String },
    prize_value: { type: Number },
    won_at: { type: Date, default: Date.now }
  }],

  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

luckyDrawSchema.index({ is_active: 1, start_time: 1, end_time: 1 });
luckyDrawSchema.index({ event_id: 1 });

module.exports = mongoose.model('LuckyDraw', luckyDrawSchema);