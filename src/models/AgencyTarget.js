const mongoose = require('mongoose');

const agencyTargetSchema = new mongoose.Schema({
  agencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agency',
    required: true,
  },
  targetType: {
    type: String,
    required: true,
    enum: ['COINS_SPENT', 'REVENUE_USD'],
  },
  targetAmount: {
    type: Number,
    required: true,
    min: 1,
  },
  durationType: {
    type: String,
    required: true,
    enum: ['CUSTOM_DAYS', 'WEEKLY', 'MONTHLY'],
  },
  durationDays: {
    type: Number,
    required: true,
    min: 1,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  currentProgress: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED'],
    default: 'ACTIVE',
  },
  rewardType: {
    type: String,
    default: 'coins',
    enum: ['coins', 'frame', 'badge', 'custom'],
  },
  rewardValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  rewardClaimed: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
  },
  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

agencyTargetSchema.index({ agencyId: 1, status: 1 });
agencyTargetSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('AgencyTarget', agencyTargetSchema);
