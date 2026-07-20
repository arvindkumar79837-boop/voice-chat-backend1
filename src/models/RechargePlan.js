const mongoose = require('mongoose');

const rechargePlanSchema = new mongoose.Schema({
  priceINR: {
    type: Number,
    required: true,
    min: 1,
  },
  coinsAwarded: {
    type: Number,
    required: true,
    min: 1,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  label: {
    type: String,
    default: '',
  },
  tagColor: {
    type: String,
    default: '#FF9800',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
}, { timestamps: true });

rechargePlanSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('RechargePlan', rechargePlanSchema);
