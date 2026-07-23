const mongoose = require('mongoose');
const UsedPurchaseToken = require('../models/UsedPurchaseToken');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const AuditLog = require('../models/AuditLog');

/**
 * Convert received diamonds for a user and credit their diamond balance.
 * Called internally after gift event creation.
 */
exports.convertGiftToDiamonds = async ({ receiverId, diamondValue, quantity, commissionRate = 0.30 }) => {
  const diamondsEarned = Math.floor(diamondValue * quantity * (1 - commissionRate));
  if (diamondsEarned <= 0) return { credited: 0 };

  await User.findByIdAndUpdate(receiverId, { $inc: { diamonds: diamondsEarned } });

  return { credited: diamondsEarned };
};

/**
 * Verify Google Play purchase and process recharge.
 */
exports.verifyGooglePlayRecharge = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { productId, purchaseToken, packageName } = req.body;

    if (!productId || !purchaseToken) {
      return res.status(400).json({ success: false, message: 'productId and purchaseToken required' });
    }

    const fraudService = require('../services/fraudDetection.service');
    const verification = await fraudService.verifyGooglePlayPurchase({
      packageName: packageName || 'com.arvindparty.app',
      productId,
      purchaseToken,
    });

    if (!verification.valid) {
      await fraudService.verifyAndEvaluateRecharge({
        userId, uid: userId, productId, purchaseToken, amountInCoins: 0,
      });
      return res.status(400).json({ success: false, message: `Purchase verification failed: ${verification.reason}` });
    }

    const RechargePlan = require('../models/RechargePlan');
    const Recharge = require('../models/Recharge');
    const plan = await RechargePlan.findOne({ googlePlayProductId: productId, isActive: true });
    if (!plan) {
      return res.status(400).json({ success: false, message: 'No matching plan found for this productId' });
    }

    // ── IAP Token Replay Prevention (P0-5) ───────────────────────────────────
      const usedToken = await UsedPurchaseToken.findOne({ token: purchaseToken });
      if (usedToken) {
        return res.status(409).json({
          success: false,
          message: 'This purchase token has already been used. Contact support if you believe this is an error.',
        });
      }
      const duplicate = await Recharge.findOne({ 'metadata.purchaseToken': purchaseToken });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'This purchase has already been processed' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      user.coins = (user.coins || 0) + plan.coinsAwarded;
      if (plan.diamondsAwarded > 0) {
        user.diamonds = (user.diamonds || 0) + plan.diamondsAwarded;
      }
      await user.save({ session });

      await Recharge.create([{
        userId: user._id,
        uid: user.uid,
        amount: plan.priceINR,
        coins: plan.coinsAwarded,
        status: 'completed',
        method: 'google_play',
        metadata: { productId, purchaseToken, packageName: packageName || 'com.arvindparty.app' },
      }], { session });

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    // Save used token to prevent replay
      await UsedPurchaseToken.create({
        token: purchaseToken,
        userId: user._id,
        productId,
        coinsAwarded: plan.coinsAwarded,
      });
      await AuditLog.create({
      action: 'GOOGLE_PLAY_RECHARGE_SUCCESS',
      executorId: userId,
      reason: `Credited ${plan.coinsAwarded} coins (+${plan.diamondsAwarded || 0} diamonds) via Google Play`,
      metadata: { productId, planId: plan._id },
    });

    return res.json({
      success: true,
      message: 'Recharge successful',
      data: {
        coinsCredited: plan.coinsAwarded,
        diamondsCredited: plan.diamondsAwarded || 0,
        newBalance: { coins: user.coins, diamonds: user.diamonds },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get wallet balance for current user
 */
exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const user = await User.findById(userId).select('coins diamonds');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: { coins: user.coins || 0, diamonds: user.diamonds || 0 } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
