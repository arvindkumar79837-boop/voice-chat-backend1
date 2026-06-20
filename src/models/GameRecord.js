const mongoose = require('mongoose');

const gameRecordSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameType: {
    type: String,
    enum: ['LUCKY_WHEEL', 'SCRATCH_CARD'],
    required: true
  },
  betAmount: {
    type: Number,
    default: 0
  },
  winAmount: {
    type: Number,
    required: true
  },
  rewardType: {
    type: String,
    enum: ['COINS', 'DIAMONDS', 'NOTHING'],
    default: 'COINS'
  }
}, { timestamps: true });

module.exports = mongoose.model('GameRecord', gameRecordSchema);