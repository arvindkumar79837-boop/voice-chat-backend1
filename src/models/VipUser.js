const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    vipLevel: Number,
    startDate: Date,
    expireDate: Date,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

schema.index({ userId: 1 });
schema.index({ isActive: 1, expireDate: 1 });

module.exports = mongoose.model('VipUser', schema);
