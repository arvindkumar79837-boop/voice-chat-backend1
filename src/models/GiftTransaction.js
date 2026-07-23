const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room'
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    giftId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gift'
    },
    quantity: Number,
    totalCoins: Number,
    diamondsEarned: Number
}, {
    timestamps: true
});


// ─── Compound Indexes (P1-2) ─────────────────────────────────────────────
schema.index({ roomId: 1, createdAt: -1 });
schema.index({ senderId: 1, createdAt: -1 });
schema.index({ receiverId: 1, createdAt: -1 });

module.exports = mongoose.model('GiftTransaction', schema);
