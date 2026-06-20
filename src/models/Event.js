const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  coverImage: { type: String, default: '' },
  type: {
    type: String,
    enum: ['party', 'blind_date', 'lucky_draw', 'pk_battle', 'mission', 'special'],
    required: true
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  rewards: {
    coins: { type: Number, default: 0 },
    diamonds: { type: Number, default: 0 },
    xp: { type: Number, default: 0 }
  },
  maxParticipants: { type: Number, default: 0 },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  participantsCount: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

eventSchema.index({ type: 1, status: 1, startDate: 1 });
eventSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Event', eventSchema);