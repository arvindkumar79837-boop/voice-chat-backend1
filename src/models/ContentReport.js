const mongoose = require('mongoose');

const contentReportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reportedContentId: {
    type: String,
  },
  contentType: {
    type: String,
    required: true,
    enum: ['PROFILE_PHOTO', 'CHAT_MESSAGE', 'ROOM_THUMBNAIL', 'MOMENT_POST', 'BLIND_DATE_SESSION', 'OTHER'],
  },
  reason: {
    type: String,
    required: true,
    enum: ['SPAM', 'NUDITY', 'VIOLENCE', 'HATE_SPEECH', 'HARASSMENT', 'FAKE_ACCOUNT', 'COPYRIGHT', 'OTHER'],
  },
  description: {
    type: String,
    default: '',
  },
  evidenceUrl: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'],
    default: 'PENDING',
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
  reviewedAt: Date,
  actionTaken: {
    type: String,
    enum: ['NONE', 'WARNING', 'CONTENT_REMOVED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED'],
    default: 'NONE',
  },
  autoFlagged: {
    type: Boolean,
    default: false,
  },
  moderationScore: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

contentReportSchema.index({ status: 1, createdAt: -1 });
contentReportSchema.index({ reportedUserId: 1 });

module.exports = mongoose.model('ContentReport', contentReportSchema);
