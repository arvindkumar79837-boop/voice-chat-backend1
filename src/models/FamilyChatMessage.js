const mongoose = require('mongoose');

const familyChatMessageSchema = new mongoose.Schema({
  familyId: { type: String, required: true, index: true },
  senderUid: { type: String, required: true, index: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String },
  message: { type: String, required: true, maxlength: 500 },
  messageType: { type: String, enum: ['text', 'image', 'system'], default: 'text' },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyChatMessage' },
  reactions: [{ emoji: String, userIds: [String] }],
  isEdited: { type: Boolean, default: false }
}, { timestamps: true });

familyChatMessageSchema.index({ familyId: 1, createdAt: -1 });
familyChatMessageSchema.index({ familyId: 1, senderUid: 1 });

module.exports = mongoose.model('FamilyChatMessage', familyChatMessageSchema);