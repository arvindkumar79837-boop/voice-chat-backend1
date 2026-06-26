const mongoose = require('mongoose');

const agencyInvitationSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
  agencyName: { type: String, required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invitedByUid: { type: String, required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetUid: { type: String, required: true },
  message: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true
  },
  respondedAt: { type: Date },
  specialRoles: {
    vipFrame: { type: Boolean, default: false },
    entryEffect: { type: String, default: '' },
    customTitle: { type: String, default: '' }
  }
}, { timestamps: true });

agencyInvitationSchema.index({ targetUserId: 1, status: 1, createdAt: -1 });
agencyInvitationSchema.index({ agencyId: 1, status: 1 });

module.exports = mongoose.model('AgencyInvitation', agencyInvitationSchema);