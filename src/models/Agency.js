const mongoose = require('mongoose');

const agencySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  ownerUid: { type: String, required: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  logo: { type: String, default: '' },
  description: { type: String, default: '' },
  hosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Active members
  pendingHostRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'HostRequest' }],
  totalHosts: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 }, // Agency lifetime diamonds/coins commission
  commissionRate: { type: Number, default: 0.1 }, // 10% default commission
  isActive: { type: Boolean, default: true },
  settings: {
    autoApproveHosts: { type: Boolean, default: false },
    minAttendanceDays: { type: Number, default: 20 },
    baseSalary: { type: Number, default: 2000 },
    attendanceBonusThreshold: { type: Number, default: 25 },
    salaryEnabled: { type: Boolean, default: true },
  }
}, { timestamps: true });

module.exports = mongoose.model('Agency', agencySchema);