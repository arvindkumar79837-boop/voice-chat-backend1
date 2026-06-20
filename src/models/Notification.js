const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['follow', 'gift', 'event', 'system', 'like', 'comment', 'mention'],
    required: true
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
  readAt: { type: Date }
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);