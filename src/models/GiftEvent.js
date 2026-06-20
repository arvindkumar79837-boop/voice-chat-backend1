const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const giftEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    unique: true,
    default: () => `GFT-${uuidv4().toUpperCase()}`
  },

  // Idempotency key from client to prevent duplicate gifts
  idempotencyKey: { type: String, required: true, unique: true },

  giftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gift', required: true },
  giftName: { type: String },

  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderUid: { type: String, required: true },

  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverUid: { type: String, required: true },

  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },

  // Amounts
  coinCostToSender: { type: Number, required: true },
  diamondValueToReceiver: { type: Number, required: true },
  quantity: { type: Number, default: 1, min: 1 },

  totalCoinsCost: { type: Number, required: true },     // coinCost * quantity
  totalDiamondsEarned: { type: Number, required: true }, // diamondValue * quantity

  // Ledger links
  senderTxnId: { type: String },   // WalletTransaction ID
  receiverTxnId: { type: String }, // WalletTransaction ID

  // Status
  status: { type: String, enum: ['COMPLETED', 'FAILED', 'REFUNDED'], default: 'COMPLETED' },

  createdAt: { type: Date, default: Date.now, immutable: true }
});

giftEventSchema.index({ senderId: 1, createdAt: -1 });
giftEventSchema.index({ receiverId: 1, createdAt: -1 });
giftEventSchema.index({ roomId: 1, createdAt: -1 });
giftEventSchema.index({ idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model('GiftEvent', giftEventSchema);
