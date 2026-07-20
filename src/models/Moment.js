const mongoose = require('mongoose');

const momentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String, default: '' },
  content: { type: String, required: true, maxlength: 500 },
  images: [{ type: String }],
  mediaUrls: [{ type: String }],
  mediaType: { type: String, enum: ['image', 'video', 'text'], default: 'text' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likesCount: { type: Number, default: 0 },
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, default: '' },
    content: { type: String, required: true },
    text: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  commentsCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  moderationStatus: { type: String, enum: ['CLEAN', 'FLAGGED', 'REMOVED'], default: 'CLEAN' },
  moderationFlagCount: { type: Number, default: 0 },
  topic: { type: String, default: '' },
  country: { type: String, default: '' },
}, { timestamps: true });

momentSchema.index({ userId: 1, createdAt: -1 });
momentSchema.index({ createdAt: -1 });
momentSchema.index({ topic: 1 });
momentSchema.index({ country: 1 });
momentSchema.index({ content: 'text' });

module.exports = mongoose.model('Moment', momentSchema);