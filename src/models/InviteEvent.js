const mongoose = require('mongoose');

const inviteEventSchema = new mongoose.Schema({
  inviter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invitee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  invite_code: { type: String, required: true, unique: true },
  invite_link: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'registered', 'recharged', 'commission_paid', 'expired'],
    default: 'pending'
  },
  commission_percent: { type: Number, default: 5 },
  commission_coins_earned: { type: Number, default: 0 },
  invitee_recharge_amount: { type: Number, default: 0 },
  invitee_joined_at: { type: Date },
  invitee_recharged_at: { type: Date },
  commission_paid_at: { type: Date },
  expires_at: { type: Date, required: true },
  is_active: { type: Boolean, default: true },
  metadata: {
    invitee_username: { type: String, default: '' },
    inviter_username: { type: String, default: '' },
    source: { type: String, default: 'direct_link' }
  }
}, { timestamps: true });

inviteEventSchema.index({ inviter_id: 1, status: 1 });
inviteEventSchema.index({ invite_code: 1 }, { unique: true });
inviteEventSchema.index({ invitee_id: 1 });
inviteEventSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('InviteEvent', inviteEventSchema);