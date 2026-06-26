// ═══════════════════════════════════════════════════════════════════════════
// MODEL: RewardInjector — Direct UID-targeted asset injection
// VIP avatar frames, entry effects, mount assets
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const rewardAssetSchema = new mongoose.Schema({
  assetType: {
    type: String,
    enum: ['vip_frame', 'entry_effect', 'mount', 'badge', 'avatar_decoration', 'chat_bubble', 'seat_frame'],
    required: true,
  },
  assetId: { type: String, required: true },
  assetName: { type: String, required: true },
  assetUrl: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary', 'mythic'], default: 'common' },
  durationDays: { type: Number, default: 0 }, // 0 = permanent
});

const rewardInjectorSchema = new mongoose.Schema(
  {
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetUid: { type: String, required: true },
    assets: [rewardAssetSchema],
    reason: { type: String, default: '' },
    injectedBy: { type: String, required: true },
    injectedByRole: { type: String, default: 'OWNER' },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

rewardInjectorSchema.index({ targetUserId: 1, isActive: 1 });
rewardInjectorSchema.index({ targetUid: 1 });

module.exports = mongoose.model('RewardInjector', rewardInjectorSchema);