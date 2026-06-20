const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
  familyId: { type: String, required: true, unique: true }, // e.g., FAM10293
  name: { type: String, required: true },
  avatar: { type: String, default: 'https://via.placeholder.com/150' },
  patriarchId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level: { type: Number, default: 1 },
  totalWealth: { type: Number, default: 0 },
  memberCount: { type: Number, default: 1 },
  announcement: { type: String, default: 'Welcome to our family!' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Family', familySchema);