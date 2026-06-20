const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    default: () => `INV-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`
  },

  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  sellerUid: { type: String, required: true },

  // Cycle
  cycleType: { type: String, enum: ['WEEKLY', '15DAY', 'MONTHLY', 'CUSTOM'] },
  cycleStart: { type: Date },
  cycleEnd: { type: Date },

  // Targets & Achievement
  targetAmount: { type: Number, required: true },
  achievedAmount: { type: Number, required: true },
  shortAmount: { type: Number }, // targetAmount - achievedAmount if missed

  // Commission
  commissionPct: { type: Number },
  commissionEarned: { type: Number, default: 0 },

  // Bonus / Penalty
  bonusAmount: { type: Number, default: 0 },
  penaltyAmount: { type: Number, default: 0 },

  // Net payout
  netPayable: { type: Number }, // commissionEarned + bonus - penalty

  status: {
    type: String,
    enum: ['GENERATED', 'APPROVED', 'PAID', 'DISPUTED'],
    default: 'GENERATED'
  },

  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt: { type: Date },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

invoiceSchema.index({ sellerId: 1, createdAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
