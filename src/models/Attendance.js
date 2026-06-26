const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  date: { type: Date, required: true }, // Date at midnight (start of day)
  sessionStart: { type: Date, required: true },
  sessionEnd: { type: Date },
  durationMinutes: { type: Number, default: 0 },
  roomId: { type: String, default: null },
  isPresent: { type: Boolean, default: true },
  isValidDay: { type: Boolean, default: false }, // true if >= 120 minutes
  totalDailyMinutes: { type: Number, default: 0 },
}, { timestamps: true });

attendanceSchema.index({ userId: 1, date: -1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);