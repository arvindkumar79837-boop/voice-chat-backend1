const mongoose = require('mongoose');

const blindDateProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  isEnabled: { type: Boolean, default: false },
  genderPreference: { type: String, enum: ['MALE', 'FEMALE', 'ANY'], default: 'ANY' },
  ageRangeMin: { type: Number, default: 18, min: 18, max: 99 },
  ageRangeMax: { type: Number, default: 35, min: 18, max: 99 },
  countryPreference: [{ type: String }],
  totalDates: { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
  lastQueuedAt: { type: Date },
  dailyQueueCount: { type: Number, default: 0 },
  dailyQueueResetAt: { type: Date },
}, { timestamps: true });

blindDateProfileSchema.index({ isEnabled: 1, genderPreference: 1 });
blindDateProfileSchema.index({ isEnabled: 1, countryPreference: 1 });

module.exports = mongoose.model('BlindDateProfile', blindDateProfileSchema);
