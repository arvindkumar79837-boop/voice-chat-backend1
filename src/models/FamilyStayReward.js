const mongoose = require('mongoose');

const familyStayRewardSchema = new mongoose.Schema({
  familyId: { type: String, required: true, index: true },
  uid: { type: String, required: true, index: true },
  roomId: { type: String, required: true, index: true },
  seatIndex: { type: Number, default: 0 },
  sessionStart: { type: Date, default: Date.now },
  sessionEnd: { type: Date },
  durationMinutes: { type: Number, default: 0 },
  coinsEarned: { type: Number, default: 0 },
  xpEarned: { type: Number, default: 0 },
  rewardInterval: { type: Number, default: 5 },
  lastRewardAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

familyStayRewardSchema.index({ familyId: 1, uid: 1, isActive: 1 });
familyStayRewardSchema.index({ roomId: 1, isActive: 1 });

module.exports = mongoose.model('FamilyStayReward', familyStayRewardSchema);