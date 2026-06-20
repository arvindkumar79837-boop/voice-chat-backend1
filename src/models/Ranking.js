const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    score: Number,
    rank: Number,
    rankingType: String, // sender, receiver, host, room, family, agency
    period: String // daily, weekly, monthly
}, {
    timestamps: true
});

// Indexing for faster ranking queries
schema.index({ rankingType: 1, period: 1, rank: 1 });
schema.index({ rankingType: 1, period: 1, score: -1 });

module.exports = mongoose.model('Ranking', schema);
