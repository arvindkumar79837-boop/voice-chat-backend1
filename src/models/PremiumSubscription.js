const mongoose = require('mongoose');

const premiumSubscriptionSchema = new mongoose.Schema({
  tierName: { type: String, required: true, unique: true, enum: ['Silver', 'Gold', 'Royal'] },
  priceINR: { type: Number, required: true, min: 1 },
  durationDays: { type: Number, required: true, enum: [30, 90, 365] },
  perks: {
    monthlyCoins: { type: Number, default: 0 },
    badgeIcon: { type: String, default: '' },
    entranceEffectId: { type: String, default: '' },
    animatedStickerPackId: { type: String, default: '' },
    friendLimitBoost: { type: Number, default: 0 },
    levelUpMultiplier: { type: Number, default: 1.0, min: 1.0, max: 5.0 },
    exclusiveNameCardId: { type: String, default: '' },
    luxuryVehicleEffectId: { type: String, default: '' },
  },
  googlePlayProductId: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  description: { type: String, default: '' },
  monthlyCoinsLastClaimedAt: { type: Date },
}, { timestamps: true });

premiumSubscriptionSchema.index({ tierName: 1 });
premiumSubscriptionSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('PremiumSubscription', premiumSubscriptionSchema);
