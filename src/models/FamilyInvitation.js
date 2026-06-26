const mongoose = require('mongoose');

const familyInvitationSchema = new mongoose.Schema({
  invitation_id: { type: String, required: true, unique: true },
  familyId: { type: String, required: true, index: true },
  family_name: { type: String, required: true },
  family_badge: { type: String, default: 'TEAM_ARVIND' },
  sender_uid: { type: String, required: true, index: true },
  sender_name: { type: String, default: '' },
  receiver_uid: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending'
  },
  message: { type: String, default: '' },
  expiresAt: { type: Date },
  respondedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

familyInvitationSchema.index({ receiver_uid: 1, status: 1 });
familyInvitationSchema.index({ familyId: 1, status: 1 });
familyInvitationSchema.index({ sender_uid: 1, status: 1 });

module.exports = mongoose.model('FamilyInvitation', familyInvitationSchema);