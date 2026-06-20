const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const withdrawalSchema = new mongoose.Schema({
  withdrawalId: {
    type: String,
    unique: true,
    default: () => `WDR-${uuidv4().substring(0, 10).toUpperCase()}`
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uid: { type: String, required: true },

  // Amount
  diamondsRequested: { type: Number, required: true },
  coinsEquivalent: { type: Number }, // Calculated server-side
  amountINR: { type: Number }, // Final payout amount

  // Bank Details (copied at time of request)
  bankAccount: { type: String, required: true },
  ifsc: { type: String, required: true },
  accountName: { type: String, required: true },
  panNumber: { type: String },

  // Approval Workflow
  // NORMAL_SELLER → SUPER_SELLER → MERCHANT → OWNER_FINANCE → PAID
  workflow: [{
    stage: { type: String },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorUid: { type: String },
    action: { type: String, enum: ['APPROVED', 'REJECTED', 'PENDING'] },
    note: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],

  currentStage: {
    type: String,
    enum: ['SELLER_REVIEW', 'MERCHANT_REVIEW', 'OWNER_FINANCE', 'PROCESSING', 'PAID', 'REJECTED'],
    default: 'SELLER_REVIEW'
  },

  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'PAID'],
    default: 'PENDING'
  },

  // Payment proof
  paymentReference: { type: String },
  paidAt: { type: Date },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // KYC check
  kycVerified: { type: Boolean, default: false },
  fraudScore: { type: Number, default: 0 },

  ipAddress: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ currentStage: 1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
