const mongoose = require('mongoose');

const visitorHistorySchema = new mongoose.Schema({
  profileOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  visitedAt: { type: Date, default: Date.now },
  duration: { type: Number, default: 0 },
  deviceInfo: { type: String },
}, { timestamps: true });

visitorHistorySchema.index({ profileOwner: 1, visitedAt: -1 });

module.exports = mongoose.model('VisitorHistory', visitorHistorySchema);