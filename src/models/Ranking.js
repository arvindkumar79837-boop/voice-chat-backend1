const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targetId: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        required: true,
        default: 0
    },
    rank: {
        type: Number,
        default: 0
    },
    rankingType: {
        type: String,
        required: true,
        enum: ['sender', 'receiver', 'host', 'room', 'family', 'agency', 'pk_battle', 'weekly_war'],
        index: true
    },
    period: {
        type: String,
        required: true,
        enum: ['daily', 'weekly', 'monthly', 'all_time'],
        index: true
    },
    periodStart: {
        type: Date,
        required: true,
        index: true
    },
    periodEnd: {
        type: Date,
        required: true
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

schema.index({ rankingType: 1, period: 1, periodStart: 1, score: -1 }, { unique: true });
schema.index({ rankingType: 1, period: 1, rank: 1 });
schema.index({ targetId: 1, rankingType: 1, period: 1 });

module.exports = mongoose.model('Ranking', schema);