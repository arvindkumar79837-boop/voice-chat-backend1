const mongoose = require('mongoose');

const heatMapEntrySchema = new mongoose.Schema({
  country: { type: String, required: true, index: true },
  state: { type: String, default: '', index: true },
  city: { type: String, default: '' },
  latitude: { type: Number, default: 0 },
  longitude: { type: Number, default: 0 },
  activeUsers: { type: Number, default: 0 },
  sessionsCount: { type: Number, default: 0 },
  totalTimeSpentMinutes: { type: Number, default: 0 },
  roomsJoined: { type: Number, default: 0 },
  giftsSent: { type: Number, default: 0 },
  diamondsEarned: { type: Number, default: 0 },
  diamondsSpent: { type: Number, default: 0 },
  hour: { type: Number, min: 0, max: 23, default: 0 },
  dayOfWeek: { type: Number, min: 0, max: 6, default: 0 },
  date: { type: Date, required: true, index: true }
}, { timestamps: true });

heatMapEntrySchema.index({ country: 1, date: -1 });
heatMapEntrySchema.index({ activeUsers: -1 });
heatMapEntrySchema.index({ country: 1, state: 1, date: -1 });
heatMapEntrySchema.index({ hour: 1, dayOfWeek: 1 });

module.exports = mongoose.model('HeatMapEntry', heatMapEntrySchema);