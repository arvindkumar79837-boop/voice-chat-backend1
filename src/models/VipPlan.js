const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    name: String,
    level: Number,
    price: Number, // In coins or real currency
    durationDays: Number,
    frame: String,
    badge: String,
    entryEffect: String,
    privileges: [String]
}, {
    timestamps: true
});

module.exports = mongoose.model('VipPlan', schema);
