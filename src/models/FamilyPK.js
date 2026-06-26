const mongoose = require('mongoose');

const familyPKSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  family1Id: { type: String, required: true },
  family1Name: { type: String, required: true },
  family1Score: { type: Number, default: 0, min: 0 },
  family1HostUid: { type: String, required: true },
  family2Id: { type: String, required: true },
  family2Name: { type: String, required: true },
  family2Score: { type: Number, default: 0, min: 0 },
  family2HostUid: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['scheduled', 'active', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  winnerFamilyId: { type: String, default: null },
  scheduledAt: { type: Date, required: true },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  giftEvents: [{
    userId: { type: String, required: true },
    giftId: { type: String, required: true },
    giftName: { type: String, required: true },
    amount: { type: Number, required: true },
    value: { type: Number, required: true },
    familyId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

familyPKSchema.index({ status: 1, scheduledAt: 1 });
familyPKSchema.index({ family1Id: 1 });
familyPKSchema.index({ family2Id: 1 });

module.exports = mongoose.model('FamilyPK', familyPKSchema);