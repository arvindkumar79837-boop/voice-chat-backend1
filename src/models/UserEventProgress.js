const mongoose = require('mongoose');

const userEventProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyTask' },
  progress: { type: Number, default: 0 },
  target_value: { type: Number, default: 0 },
  is_completed: { type: Boolean, default: false },
  is_claimed: { type: Boolean, default: false },
  completed_at: { type: Date },
  claimed_at: { type: Date },
  streak_count: { type: Number, default: 0 },
  last_activity_date: { type: Date },
  metadata: {
    roomId: { type: String },
    giftId: { type: mongoose.Schema.Types.ObjectId },
    battleId: { type: mongoose.Schema.Types.ObjectId },
    treasureKey: { type: String }
  }
}, { timestamps: true });

userEventProgressSchema.index({ userId: 1, eventId: 1, taskId: 1 }, { unique: true });
userEventProgressSchema.index({ userId: 1, is_completed: 1 });
userEventProgressSchema.index({ eventId: 1, is_completed: 1 });

module.exports = mongoose.model('UserEventProgress', userEventProgressSchema);