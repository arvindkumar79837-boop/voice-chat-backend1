const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    user1Id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    user2Id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cpLevel: {
        type: Number,
        default: 1
    },
    cpExp: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

schema.index({ user1Id: 1, user2Id: 1 }, { unique: true });
schema.index({ isActive: 1 });

module.exports = mongoose.model('CpPair', schema);
