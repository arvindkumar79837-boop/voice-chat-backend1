const mongoose = require('mongoose');

const momentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: { type: String, required: true },
  userAvatar: { type: String, default: '' },
  content: { type: String, required: true, maxlength: 500 },
  images: [{ type: String }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likesCount: { type: Number, default: 0 },
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  commentsCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

momentSchema.index({ userId: 1, createdAt: -1 });
momentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Moment', momentSchema);