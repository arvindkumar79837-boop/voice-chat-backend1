// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER: RewardInjectorController — Direct UID-targeted asset injection
// VIP avatar frames, entry effects, mounts, badges for specific users
// ═══════════════════════════════════════════════════════════════════════════

const RewardInjector = require('../models/RewardInjector');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * POST /api/admin/rewards/inject
 * Owner/Admin: Inject assets directly to a target UID
 */
exports.injectReward = async (req, res) => {
  try {
    const { targetUid, assets, reason } = req.body;

    if (!targetUid || !assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ success: false, message: 'Target UID and assets array required' });
    }

    const user = await User.findOne({ uid: targetUid });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found with this UID' });
    }

    // Validate each asset
    for (const asset of assets) {
      if (!asset.assetType || !asset.assetId || !asset.assetName) {
        return res.status(400).json({ success: false, message: 'Each asset needs assetType, assetId, assetName' });
      }
    }

    // Calculate expiration if duration is set
    let expiresAt = null;
    const hasDuration = assets.some((a) => a.durationDays && a.durationDays > 0);
    if (hasDuration) {
      const maxDays = Math.max(...assets.map((a) => a.durationDays || 0));
      expiresAt = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000);
    }

    const injector = await RewardInjector.create({
      targetUserId: user._id,
      targetUid,
      assets,
      reason: reason || 'Admin/Owner reward injection',
      injectedBy: req.user?.userId || 'OWNER',
      injectedByRole: req.user?.role || 'OWNER',
      expiresAt,
    });

    // Update user inventory (add assets to their equipped/owned items)
    if (!user.inventory) user.inventory = {};
    if (!user.inventory.ownedAssets) user.inventory.ownedAssets = [];
    
    for (const asset of assets) {
      user.inventory.ownedAssets.push({
        assetType: asset.assetType,
        assetId: asset.assetId,
        assetName: asset.assetName,
        acquiredAt: new Date(),
        expiresAt: asset.durationDays > 0
          ? new Date(Date.now() + asset.durationDays * 24 * 60 * 60 * 1000)
          : null,
      });
    }
    await user.save();

    // Audit log
    await AuditLog.create({
      action: 'REWARD_INJECT',
      performedBy: req.user?.userId || 'OWNER',
      details: `Injected ${assets.length} assets to UID ${targetUid}. Reason: ${reason || 'N/A'}`,
      metadata: { targetUid, assetCount: assets.length, assetTypes: assets.map((a) => a.assetType) },
    });

    return res.status(200).json({
      success: true,
      message: `${assets.length} asset(s) injected to UID ${targetUid}`,
      data: injector,
    });
  } catch (error) {
    console.error('injectReward Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/admin/rewards/history
 * Get reward injection history with filters
 */
exports.getRewardHistory = async (req, res) => {
  try {
    const { targetUid, assetType, page, limit } = req.query;
    const query = {};
    if (targetUid) query.targetUid = targetUid;
    if (assetType) query['assets.assetType'] = assetType;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;

    const [rewards, total] = await Promise.all([
      RewardInjector.find(query)
        .populate('targetUserId', 'uid name username avatar')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      RewardInjector.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: rewards,
      pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error('getRewardHistory Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/rewards/revoke/:id
 * Revoke an active reward injection
 */
exports.revokeReward = async (req, res) => {
  try {
    const injector = await RewardInjector.findById(req.params.id);
    if (!injector) {
      return res.status(404).json({ success: false, message: 'Reward injection not found' });
    }

    injector.isActive = false;
    await injector.save();

    await AuditLog.create({
      action: 'REWARD_REVOKE',
      performedBy: req.user?.userId || 'OWNER',
      details: `Revoked reward injection for UID ${injector.targetUid}`,
      metadata: { injectorId: injector._id.toString(), targetUid: injector.targetUid },
    });

    return res.status(200).json({ success: true, message: 'Reward injection revoked', data: injector });
  } catch (error) {
    console.error('revokeReward Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/admin/rewards/user/:uid
 * Get all active rewards for a specific UID
 */
exports.getUserRewards = async (req, res) => {
  try {
    const rewards = await RewardInjector.find({
      targetUid: req.params.uid,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const allAssets = [];
    for (const reward of rewards) {
      for (const asset of reward.assets) {
        allAssets.push({
          ...asset,
          rewardId: reward._id,
          injectedAt: reward.createdAt,
          expiresAt: reward.expiresAt,
        });
      }
    }

    return res.status(200).json({ success: true, data: allAssets });
  } catch (error) {
    console.error('getUserRewards Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};