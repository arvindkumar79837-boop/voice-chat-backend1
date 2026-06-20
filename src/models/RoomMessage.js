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
    senderName: String,
    message: String,
    messageType: {
        type: String,
        default: 'text' // text, gift, join, leave, system, announcement
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RoomMessage', schema);
