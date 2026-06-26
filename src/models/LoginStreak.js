const mongoose = require('mongoose');

const loginStreakSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  current_streak: { type: Number, default: 0 },
  longest_streak: { type: Number, default: 0 },
  last_login_date: { type: Date },
  
  // 7-day streak milestones
  day_7_reward_claimed: { type: Boolean, default: false },
  day_30_reward_claimed: { type: Boolean, default: false },
  
  // Running 30-day history
  login_history: [{
    date: { type: Date, required: true },
    rewarded: { type: Boolean, default: false },
    reward_type: { type: String, default: '' },
    reward_value: { type: Number, default: 0 }
  }],

  // Consecutive login rewards for day 1-7
  daily_rewards: {
    day_1: { coins: { type: Number, default: 10 }, diamonds: { type: Number, default: 0 }, xp: { type: Number, default: 5 } },
    day_2: { coins: { type: Number, default: 20 }, diamonds: { type: Number, default: 0 }, xp: { type: Number, default: 10 } },
    day_3: { coins: { type: Number, default: 30 }, diamonds: { type: Number, default: 1 }, xp: { type: Number, default: 15 } },
    day_4: { coins: { type: Number, default: 40 }, diamonds: { type: Number, default: 2 }, xp: { type: Number, default: 20 } },
    day_5: { coins: { type: Number, default: 50 }, diamonds: { type: Number, default: 3 }, xp: { type: Number, default: 25 } },
    day_6: { coins: { type: Number, default: 60 }, diamonds: { type: Number, default: 4 }, xp: { type: Number, default: 30 } },
    day_7: { coins: { type: Number, default: 100 }, diamonds: { type: Number, default: 10 }, xp: { type: Number, default: 50 } },
    day_30: { coins: { type: Number, default: 500 }, diamonds: { type: Number, default: 50 }, xp: { type: Number, default: 200 }, special_badge: { type: String, default: 'loyal_fighter' } }
  },

  // Special rewards (chat bubbles, entry effects)
  special_rewards_unlocked: [{
    type: { type: String, enum: ['chat_bubble', 'entry_effect', 'frame', 'badge'] },
    id: { type: String, default: '' },
    name: { type: String, default: '' },
    unlocked_at: { type: Date, default: Date.now },
    streak_milestone: { type: Number, default: 0 }
  }],

  total_logins: { type: Number, default: 0 },
  total_rewards_claimed: { type: Number, default: 0 }
}, { timestamps: true });

loginStreakSchema.index({ userId: 1 });
loginStreakSchema.index({ last_login_date: -1 });

module.exports = mongoose.model('LoginStreak', loginStreakSchema);