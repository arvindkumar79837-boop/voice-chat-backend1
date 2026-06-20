const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const settlementSchema = new mongoose.Schema({
  settlementId: {
    type: String,
    unique: true,
    default: () => `STL-${uuidv4().substring(0, 10).toUpperCase()}`
  },

  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hostUid: { type: String, required: true },

  assignedSellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  assignedSellerUid: { type: String },

  // Diamonds to settle
  diamondsToSettle: { type: Number, required: true },
  coinsEquivalent: { type: Number }, // Server calculated

  // ⚠️ RULE: NEVER set host.diamonds = 0 directly
  // Always go through settlement workflow
  diamondsLockedAt: { type: Date }, // When diamonds locked in pending

  // Cycle info
  cycleStart: { type: Date },
  cycleEnd: { type: Date },
  cycleDays: { type: Number },

  // Approval workflow
  status: {
    type: String,
    enum: ['PENDING_SELLER', 'SELLER_APPROVED', 'PENDING_PAYMENT', 'PAID', 'DISPUTED', 'CANCELLED'],
    default: 'PENDING_SELLER'
  },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },

  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt: { type: Date },

  paymentReference: { type: String },
  notes: { type: String },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

settlementSchema.index({ hostId: 1 });
settlementSchema.index({ assignedSellerId: 1 });
settlementSchema.index({ status: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);
