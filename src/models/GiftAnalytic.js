const mongoose = require('mongoose');

const giftAnalyticSchema = new mongoose.Schema({
  giftId: { type: String, required: true, index: true },
  giftName: { type: String, required: true },
  giftCategory: { type: String, default: 'standard' },
  totalSentCount: { type: Number, default: 0 },
  totalDiamondValue: { type: Number, default: 0 },
  uniqueSenders: { type: Number, default: 0 },
  uniqueReceivers: { type: Number, default: 0 },
  topRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  topRoomName: { type: String, default: '' },
  topRoomGiftCount: { type: Number, default: 0 },
  topRoomDiamondValue: { type: Number, default: 0 },
  progressiveBlastCount: { type: Number, default: 0 },
  highestProgressiveBlastValue: { type: Number, default: 0 },
  highestProgressiveBlastRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  highestProgressiveBlastRoomName: { type: String, default: '' },
  date: { type: Date, required: true, index: true }
}, { timestamps: true });

giftAnalyticSchema.index({ giftId: 1, date: -1 });
giftAnalyticSchema.index({ totalSentCount: -1 });
giftAnalyticSchema.index({ totalDiamondValue: -1 });
giftAnalyticSchema.index({ date: -1 });

module.exports = mongoose.model('GiftAnalytic', giftAnalyticSchema);