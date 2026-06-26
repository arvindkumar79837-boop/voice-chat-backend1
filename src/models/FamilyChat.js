const mongoose = require('mongoose');

const familyChatSchema = new mongoose.Schema({
  familyId: { type: String, required: true },
  senderUid: { type: String, required: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String, default: '' },
  messageType: { 
    type: String, 
    enum: ['text', 'image', 'system', 'gift'],
    default: 'text'
  },
  content: { type: String, required: true },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyChat', default: null },
  reactions: [{
    uid: { type: String, required: true },
    emoji: { type: String, required: true },
    reactedAt: { type: Date, default: Date.now }
  }],
  mentions: [{ type: String }],
  attachments: [{
    type: { type: String, enum: ['image', 'video', 'file'] },
    url: { type: String, required: true },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 }
  }],
  isDeleted: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

familyChatSchema.index({ familyId: 1, createdAt: -1 });
familyChatSchema.index({ familyId: 1, isPinned: -1 });

module.exports = mongoose.model('FamilyChat', familyChatSchema);