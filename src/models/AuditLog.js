const mongoose = require('mongoose');

// ⚠️ APPEND ONLY — NO EDIT, NO DELETE EVER
const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      // Seller actions
      'SELLER_CREATED', 'SELLER_SUSPENDED', 'SELLER_REACTIVATED', 'SELLER_DELETED',
      'SELLER_ROLE_CHANGE_ATTEMPT', // Should be blocked
      // Financial actions
      'RECHARGE_INITIATED', 'RECHARGE_SUCCESS', 'RECHARGE_FAILED', 'RECHARGE_REFUNDED',
      'GIFT_SENT', 'GIFT_RECEIVED',
      'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_PAID',
      'SETTLEMENT_CREATED', 'SETTLEMENT_APPROVED', 'SETTLEMENT_PAID', 'SETTLEMENT_DISPUTED',
      'DIAMOND_EXCHANGE',
      // Target/Commission
      'TARGET_UPDATED', 'TARGET_ACHIEVED', 'TARGET_MISSED',
      'COMMISSION_EARNED', 'BONUS_APPLIED', 'PENALTY_APPLIED',
      'COMMISSION_UPDATED',
      // Invoice
      'INVOICE_GENERATED',
      // Admin actions
      'USER_BANNED', 'USER_UNBANNED',
      'ADMIN_WALLET_ADJUSTMENT',
      'SETTINGS_UPDATED',
      // Security
      'SUSPICIOUS_ACTIVITY', 'DEVICE_FLAGGED', 'RATE_LIMIT_EXCEEDED',
      'INVALID_PAYMENT_CLAIM', // Client sent fake payment success
      // Room
      'ROOM_CREATED', 'ROOM_CLOSED',
      'USER_KICKED', 'USER_MUTED',
      // Auth
      'LOGIN', 'LOGOUT', 'TOKEN_REFRESH'
    ]
  },

  executorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  executorUid: { type: String },
  executorRole: { type: String },

  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetUid: { type: String },

  // Related entities
  relatedSellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  relatedTransactionId: { type: String },
  relatedSettlementId: { type: String },
  relatedWithdrawalId: { type: String },

  // Details
  reason: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }, // Extra data

  // Security
  ipAddress: { type: String },
  userAgent: { type: String },
  deviceId: { type: String },

  createdAt: { type: Date, default: Date.now, immutable: true }
}, { strict: true });

// Prevent updates/deletes
auditLogSchema.pre('findOneAndUpdate', function() {
  throw new Error('AuditLog is APPEND ONLY — no updates allowed');
});
auditLogSchema.pre('updateOne', function() {
  throw new Error('AuditLog is APPEND ONLY — no updates allowed');
});
auditLogSchema.pre('deleteOne', function() {
  throw new Error('AuditLog is APPEND ONLY — no deletes allowed');
});
auditLogSchema.pre('deleteMany', function() {
  throw new Error('AuditLog is APPEND ONLY — no deletes allowed');
});

auditLogSchema.index({ action: 1 });
auditLogSchema.index({ executorId: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
