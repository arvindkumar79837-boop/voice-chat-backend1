const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  iconPath: { type: String, required: true },
  unlockCondition: {
    conditionType: {
      type: String, // 'diamonds', 'coins', 'gifts', 'level', 'custom'
      required: true
    },
    value: { type: Number, required: true },
    comparison: { type: String, enum: ['>=', '>', '=', '<', '<='], default: '>=' }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Badge', badgeSchema);