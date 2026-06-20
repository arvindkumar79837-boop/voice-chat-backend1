const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['recharge', 'gift_sent', 'gift_received', 'withdrawal', 'bonus', 'admin'],
    required: true
  },
  amount: { type: Number, required: true },
  description: { type: String, default: '' },
  ref: { type: String, default: '' }
}, { timestamps: true });

schema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', schema);
