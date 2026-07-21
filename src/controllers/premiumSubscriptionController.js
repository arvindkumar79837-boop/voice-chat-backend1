const PremiumSubscription = require('../models/PremiumSubscription');
const User = require('../models/User');
const Staff = require('../models/Staff');
const AuditLog = require('../models/AuditLog');
const SystemSettings = require('../models/SystemSettings');
const SubscriptionPurchaseLog = require('../models/SubscriptionPurchaseLog');
const fraudService = require('../services/fraudDetection.service');

// ─── ADMIN/OWNER: CRUD ────────────────────────────────────────────

exports.createTier = async (req, res) => {
  try {
    const { tierName, priceINR, durationDays, perks, googlePlayProductId, description, sortOrder } = req.body;
    if (!tierName || !priceINR || !durationDays) {
      return res.status(400).json({ success: false, message: 'tierName, priceINR, durationDays required' });
    }
    const existing = await PremiumSubscription.findOne({ tierName });
    if (existing) return res.status(409).json({ success: false, message: `Tier "${tierName}" already exists` });
    const tier = await PremiumSubscription.create({ tierName, priceINR, durationDays, perks, googlePlayProductId, description, sortOrder });
    return res.json({ success: true, data: tier });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.updateTier = async (req, res) => {
  try {
    const { tierId } = req.params;
    const updates = req.body;
    const tier = await PremiumSubscription.findByIdAndUpdate(tierId, { $set: updates }, { new: true });
    if (!tier) return res.status(404).json({ success: false, message: 'Tier not found' });
    return res.json({ success: true, data: tier });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteTier = async (req, res) => {
  try {
    const { tierId } = req.params;
    const activeUsers = await User.countDocuments({ 'activeSubscription.tierId': tierId, 'activeSubscription.expiresAt': { $gt: new Date() } });
    if (activeUsers > 0) return res.status(400).json({ success: false, message: `${activeUsers} users still active on this tier. Wait for expiry.` });
    await PremiumSubscription.findByIdAndDelete(tierId);
    return res.json({ success: true, message: 'Tier deleted' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.listTiers = async (req, res) => {
  try {
    const tiers = await PremiumSubscription.find({ isActive: true }).sort({ sortOrder: 1 });
    return res.json({ success: true, data: tiers });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.getTier = async (req, res) => {
  try {
    const tier = await PremiumSubscription.findById(req.params.tierId);
    if (!tier) return res.status(404).json({ success: false, message: 'Tier not found' });
    return res.json({ success: true, data: tier });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── USER: Verify Play Subscription Receipt ────────────────────────

exports.verifyPlaySubscription = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { purchaseToken, productId, tierId } = req.body;
    if (!purchaseToken || !productId || !tierId) {
      return res.status(400).json({ success: false, message: 'purchaseToken, productId, tierId required' });
    }

    const tier = await PremiumSubscription.findById(tierId);
    if (!tier) return res.status(404).json({ success: false, message: 'Subscription tier not found' });

    // ─── DUPLICATE TOKEN CHECK ──────────────────────────────────────────
    const existingLog = await SubscriptionPurchaseLog.findOne({ purchaseToken });
    if (existingLog) {
      return res.status(400).json({ success: false, message: 'This purchase has already been processed' });
    }

    // ─── SERVER-SIDE GOOGLE PLAY VERIFICATION ───────────────────────────
    const verification = await fraudService.verifyGooglePlaySubscription({
      packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME,
      productId,
      purchaseToken,
    });

    if (!verification.valid) {
      return res.status(400).json({ success: false, message: `Subscription verification failed: ${verification.reason}` });
    }

    // Use Google Play expiry if available, otherwise fallback to calculated expiry
    const expiresAt = verification.expiryTimeMillis
      ? new Date(verification.expiryTimeMillis)
      : new Date(Date.now() + tier.durationDays * 86400000);

    // ─── ACTIVATE SUBSCRIPTION ──────────────────────────────────────────
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      const staff = await Staff.findById(userId);
      if (staff) {
        staff.activeSubscription = { tierId: tier._id, expiresAt };
        await staff.save();
      } else {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    } else {
      targetUser.activeSubscription = { tierId: tier._id, expiresAt };
      await targetUser.save();
    }

    // ─── LOG PURCHASE FOR DUPLICATE PREVENTION ──────────────────────────
    await SubscriptionPurchaseLog.create({
      userId,
      purchaseToken,
      productId,
      tierId: tier._id,
      expiresAt,
      status: 'ACTIVE',
      verificationResponse: verification,
    });

    await AuditLog.create({
      action: 'SUBSCRIPTION_ACTIVATED',
      executorId: userId,
      reason: `${tier.tierName} subscription activated via Google Play (verified server-side)`,
      metadata: { tierId: tier._id, tierName: tier.tierName, expiresAt, productId, isTrial: verification.isTrial },
    });

    return res.json({
      success: true,
      message: `${tier.tierName} subscription activated`,
      data: { tierName: tier.tierName, expiresAt, perks: tier.perks, isTrial: verification.isTrial },
    });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── USER: Claim Monthly Coins ────────────────────────────────────

exports.claimMonthlyCoins = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const user = await User.findById(userId);
    if (!user || !user.activeSubscription?.tierId) {
      return res.status(400).json({ success: false, message: 'No active subscription' });
    }
    if (user.activeSubscription.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Subscription expired' });
    }

    const tier = await PremiumSubscription.findById(user.activeSubscription.tierId);
    if (!tier || !tier.perks?.monthlyCoins) {
      return res.status(400).json({ success: false, message: 'No monthly coins perk on this tier' });
    }

    const lastClaimed = tier.monthlyCoinsLastClaimedAt;
    const now = new Date();
    if (lastClaimed) {
      const daysSince = (now - lastClaimed) / 86400000;
      if (daysSince < 28) {
        return res.status(400).json({ success: false, message: `Monthly coins already claimed. Next claim in ${Math.ceil(28 - daysSince)} days` });
      }
    }

    // ─── ATOMIC COIN CREDIT ───
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: tier.perks.monthlyCoins } },
      { new: true }
    );
    tier.monthlyCoinsLastClaimedAt = now;
    await tier.save();

    return res.json({ success: true, message: `+${tier.perks.monthlyCoins} coins credited`, data: { coins: updatedUser.coins } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── USER: Get My Subscription Status ─────────────────────────────

exports.getMySubscription = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const user = await User.findById(userId).select('activeSubscription');
    if (!user || !user.activeSubscription?.tierId) {
      return res.json({ success: true, data: null });
    }
    const tier = await PremiumSubscription.findById(user.activeSubscription.tierId);
    return res.json({
      success: true,
      data: {
        tierName: tier?.tierName,
        expiresAt: user.activeSubscription.expiresAt,
        isActive: user.activeSubscription.expiresAt > new Date(),
        perks: tier?.perks,
      },
    });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── CRON: Deactivate Expired Subscriptions ───────────────────────

exports.deactivateExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    const result = await User.updateMany(
      { 'activeSubscription.expiresAt': { $lte: now }, 'activeSubscription.tierId': { $ne: null } },
      { $set: { 'activeSubscription.tierId': null, 'activeSubscription.expiresAt': null } }
    );
    const staffResult = await Staff.updateMany(
      { 'activeSubscription.expiresAt': { $lte: now }, 'activeSubscription.tierId': { $ne: null } },
      { $set: { 'activeSubscription.tierId': null, 'activeSubscription.expiresAt': null } }
    );
    const total = result.modifiedCount + staffResult.modifiedCount;
    if (total > 0) console.log(`✅ Subscription cron: ${total} expired subscriptions deactivated`);
    return total;
  } catch (err) { console.error('Subscription cron error:', err.message); return 0; }
};
