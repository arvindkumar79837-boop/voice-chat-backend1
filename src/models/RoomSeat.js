const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room'
    },
    seatNumber: {
        type: Number,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    userName: {
        type: String,
        default: ''
    },
    isLocked: {
        type: Boolean,
        default: false
    },
    isMuted: {
        type: Boolean,
        default: false
    },
    isHost: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('RoomSeat', schema);
