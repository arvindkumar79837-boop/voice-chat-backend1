const mongoose = require('mongoose');

const pkBattleSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  opponentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  status: { 
    type: String, 
    enum: ['pending', 'live', 'finished', 'rejected', 'cancelled'], 
    default: 'pending' 
  },
  hostScore: { type: Number, default: 0 },
  opponentScore: { type: Number, default: 0 },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  durationMinutes: { type: Number, default: 5 },
  startedAt: { type: Date },
  endedAt: { type: Date }
}, { timestamps: true });

// Compound index for fast active battle lookup
pkBattleSchema.index({ roomId: 1, status: 1 });

module.exports = mongoose.model('PKBattle', pkBattleSchema);