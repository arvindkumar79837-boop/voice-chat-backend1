const mongoose = require('mongoose');

const missionProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastResetDate: { type: String, required: true }, // Format: YYYY-MM-DD
  dailyLogin: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  giftsSent: { type: Number, default: 0 },
  claimedMissions: [{ type: String }] // Array of mission IDs claimed today
});

module.exports = mongoose.model('MissionProgress', missionProgressSchema);