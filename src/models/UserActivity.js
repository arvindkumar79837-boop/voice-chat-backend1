const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true, index: true },
  isActive: { type: Boolean, default: false },
  timeSpentMinutes: { type: Number, default: 0 },
  sessionsCount: { type: Number, default: 0 },
  roomsJoined: { type: Number, default: 0 },
  giftsSent: { type: Number, default: 0 },
  giftsReceived: { type: Number, default: 0 },
  diamondsEarned: { type: Number, default: 0 },
  diamondsSpent: { type: Number, default: 0 },
  messagesSent: { type: Number, default: 0 },
  lastSeenAt: { type: Date },
  ipAddress: { type: String },
  country: { type: String },
  state: { type: String },
  city: { type: String },
  deviceModel: { type: String },
  appVersion: { type: String }
}, { timestamps: true });

userActivitySchema.index({ userId: 1, date: -1 });
userActivitySchema.index({ date: -1 });
userActivitySchema.index({ isActive: 1, date: -1 });
userActivitySchema.index({ country: 1, date: -1 });
userActivitySchema.index({ state: 1, date: -1 });

module.exports = mongoose.model('UserActivity', userActivitySchema);