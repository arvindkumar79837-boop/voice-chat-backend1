const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who recruited this agent
  uid: { type: String, required: true },
  name: { type: String, required: true },
  avatar: { type: String, default: '' },
  joinedAt: { type: Date, default: Date.now },
  totalHostsRecruited: { type: Number, default: 0 },
  activeHosts: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 5 }, // default 5% on recruited hosts' business
  totalEarningsGenerated: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

agentSchema.index({ agencyId: 1, uid: 1 }, { unique: true });

module.exports = mongoose.model('Agent', agentSchema);