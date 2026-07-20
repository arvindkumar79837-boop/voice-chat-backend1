const mongoose = require('mongoose');

const accountDeletionRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  uid: {
    type: String,
    required: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  scheduledDeletionAt: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'CANCELLED', 'COMPLETED'],
    default: 'PENDING',
  },
  reason: {
    type: String,
    default: '',
  },
  completedAt: Date,
}, { timestamps: true });

accountDeletionRequestSchema.index({ status: 1, scheduledDeletionAt: 1 });

module.exports = mongoose.model('AccountDeletionRequest', accountDeletionRequestSchema);
