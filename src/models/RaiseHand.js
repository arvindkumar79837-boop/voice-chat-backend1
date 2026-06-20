const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    userName: String,
    status: {
        type: String,
        default: 'pending' // pending, approved, rejected
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RaiseHand', schema);
