const RewardConfig = require('../models/RewardConfig');
const LuckyDraw = require('../models/LuckyDraw');
const TreasureHunt = require('../models/TreasureHunt');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { getSocketIo } = require('../sockets/socketManager');

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER: RewardConfigController — Dynamic reward configuration & management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/reward-configs
 * Create a new reward configuration
 */
exports.createRewardConfig = async (req, res) => {
  try {
    const payload = req.body;
    const userId = req.user?.userId || 'OWNER';
    
    if (!payload.configName || !payload.gameType || !payload.startTime || !payload.endTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: configName, gameType, startTime, endTime' 
      });
    }

    if (!payload.rewardItems || payload.rewardItems.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one reward item is required' 
      });
    }

    const totalProbability = payload.rewardItems.reduce((sum, item) => sum + (item.probability || 0), 0);
    if (Math.abs(totalProbability - 100) > 0.01) {
      return res.status(400).json({ 
        success: false, 
        message: `Total probability must equal 100%. Current: ${totalProbability}%` 
      });
    }

    const config = await RewardConfig.create({
      ...payload,
      deployedBy: userId
    });

    await AuditLog.create({
      action: 'REWARD_CONFIG_CREATE',
      performedBy: userId,
      details: `Created reward config: ${payload.configName} for ${payload.gameType}`,
      metadata: { configId: config._id, configName: payload.configName, gameType: payload.gameType }
    });

    res.status(201).json({ success: true, message: 'Reward config created', data: config });
  } catch (error) {
    console.error('Create RewardConfig Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create reward config' });
  }
};

/**
 * GET /api/admin/reward-configs
 * Get all reward configurations with filters
 */
exports.getAllRewardConfigs = async (req, res) => {
  try {
    const { gameType, isActive, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (gameType) query.gameType = gameType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const [configs, total] = await Promise.all([
      RewardConfig.find(query)
        .populate('deployedBy', 'name uid')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      RewardConfig.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: configs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get RewardConfigs Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reward configs' });
  }
};

/**
 * GET /api/admin/reward-configs/:id
 * Get a single reward configuration by ID
 */
exports.getRewardConfigById = async (req, res) => {
  try {
    const config = await RewardConfig.findById(req.params.id)
      .populate('deployedBy', 'name uid')
      .lean();
    
    if (!config) {
      return res.status(404).json({ success: false, message: 'Reward config not found' });
    }

    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error('Get RewardConfig Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reward config' });
  }
};

/**
 * PUT /api/admin/reward-configs/:id
 * Update a reward configuration (live deployment)
 */
exports.updateRewardConfig = async (req, res) => {
  try {
    const config = await RewardConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Reward config not found' });
    }

    const oldConfig = { ...config.toObject() };
    const updates = req.body;

    if (updates.rewardItems && updates.rewardItems.length > 0) {
      const totalProbability = updates.rewardItems.reduce((sum, item) => sum + (item.probability || 0), 0);
      if (Math.abs(totalProbability - 100) > 0.01) {
        return res.status(400).json({ 
          success: false, 
          message: `Total probability must equal 100%. Current: ${totalProbability}%` 
        });
      }
    }

    Object.assign(config, updates);
    config.version = incrementVersion(config.version);
    await config.save();

    await AuditLog.create({
      action: 'REWARD_CONFIG_UPDATE',
      performedBy: req.user?.userId || 'OWNER',
      details: `Updated reward config: ${config.configName}`,
      metadata: { 
        configId: config._id, 
        changes: detectChanges(oldConfig, config.toObject()) 
      }
    });

    // Broadcast update via Socket.IO for real-time sync
    try {
      const io = getSocketIo();
      io.to(`game:${config.gameType}`).emit('reward_config_updated', {
        configId: config._id,
        configName: config.configName,
        gameType: config.gameType,
        version: config.version,
        timestamp: new Date()
      });
    } catch (socketError) {
      console.warn('Socket broadcast failed:', socketError.message);
    }

    res.status(200).json({ success: true, message: 'Reward config updated', data: config });
  } catch (error) {
    console.error('Update RewardConfig Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update reward config' });
  }
};

/**
 * DELETE /api/admin/reward-configs/:id
 * Delete a reward configuration
 */
exports.deleteRewardConfig = async (req, res) => {
  try {
    const config = await RewardConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Reward config not found' });
    }

    if (config.isDefault) {
      return res.status(400).json({ success: false, message: 'Cannot delete default config' });
    }

    await RewardConfig.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'REWARD_CONFIG_DELETE',
      performedBy: req.user?.userId || 'OWNER',
      details: `Deleted reward config: ${config.configName}`,
      metadata: { configId: config._id, configName: config.configName }
    });

    res.status(200).json({ success: true, message: 'Reward config deleted' });
  } catch (error) {
    console.error('Delete RewardConfig Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete reward config' });
  }
};

/**
 * POST /api/admin/reward-configs/:id/deploy
 * Deploy a config as active (stops previous active configs for same gameType)
 */
exports.deployRewardConfig = async (req, res) => {
  try {
    const config = await RewardConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Reward config not found' });
    }

    await RewardConfig.updateMany(
      { gameType: config.gameType, isActive: true, _id: { $ne: config._id } },
      { isActive: false }
    );

    config.isActive = true;
    config.isDefault = true;
    await config.save();

    // Sync to LuckyDraw or TreasureHunt based on gameType
    await syncToGameModel(config);

    await AuditLog.create({
      action: 'REWARD_CONFIG_DEPLOY',
      performedBy: req.user?.userId || 'OWNER',
      details: `Deployed reward config: ${config.configName} for ${config.gameType}`,
      metadata: { configId: config._id, gameType: config.gameType }
    });

    // Broadcast deployment
    try {
      const io = getSocketIo();
      io.to(`game:${config.gameType}`).emit('reward_config_deployed', {
        configId: config._id,
        configName: config.configName,
        gameType: config.gameType,
        version: config.version,
        timestamp: new Date()
      });
    } catch (socketError) {
      console.warn('Socket broadcast failed:', socketError.message);
    }

    res.status(200).json({ success: true, message: 'Reward config deployed', data: config });
  } catch (error) {
    console.error('Deploy RewardConfig Error:', error);
    res.status(500).json({ success: false, message: 'Failed to deploy reward config' });
  }
};

/**
 * GET /api/admin/reward-configs/analytics/:id
 * Get analytics for a reward configuration
 */
exports.getRewardAnalytics = async (req, res) => {
  try {
    const config = await RewardConfig.findById(req.params.id)
      .select('analytics totalSpinsUsed totalWinners totalCoinsIn totalRewardsOut')
      .lean();
    
    if (!config) {
      return res.status(404).json({ success: false, message: 'Reward config not found' });
    }

    const roi = config.totalCoinsIn > 0 
      ? ((config.totalCoinsIn - config.totalRewardsOut) / config.totalCoinsIn * 100).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        ...config,
        roi,
        houseEdge: (100 - parseFloat(roi)).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Get Analytics Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};

/**
 * GET /api/admin/reward-configs/tiers
 * Get all available reward tiers
 */
exports.getRewardTiers = async (req, res) => {
  try {
    const tiers = [
      { rarity: 'common', label: 'Common', color: '#9E9E9E', probability: '40-60%' },
      { rarity: 'uncommon', label: 'Uncommon', color: '#4CAF50', probability: '20-30%' },
      { rarity: 'rare', label: 'Rare', color: '#2196F3', probability: '10-15%' },
      { rarity: 'epic', label: 'Epic', color: '#9C27B0', probability: '3-8%' },
      { rarity: 'legendary', label: 'Legendary', color: '#FF9800', probability: '0.5-2%' },
      { rarity: 'mythic', label: 'Mythic', color: '#F44336', probability: '0.1-0.5%' }
    ];

    res.status(200).json({ success: true, data: tiers });
  } catch (error) {
    console.error('Get Tiers Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tiers' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function incrementVersion(current) {
  const parts = current.split('.');
  const patch = parseInt(parts[2] || '0') + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

function detectChanges(oldObj, newObj) {
  const changes = {};
  for (const key in newObj) {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      changes[key] = { from: oldObj[key], to: newObj[key] };
    }
  }
  return changes;
}

async function syncToGameModel(config) {
  if (config.gameType === 'lucky_spin') {
    await LuckyDraw.updateMany(
      { is_active: true },
      { 
        segments: config.rewardItems.map(item => ({
          label: item.itemName,
          prize_type: item.itemType,
          prize_value: item.itemValue,
          prize_name: item.itemName,
          prize_id: item.itemId,
          weight: item.weight,
          color: config.tiers.find(t => t.tierName === item.tier)?.colorCode || '#FF6B6B'
        })),
        spin_cost_coins: config.spinCostCoins,
        spin_cost_diamonds: config.spinCostDiamonds,
        max_spins_per_user: config.maxSpinsPerUser,
        total_spins_allowed: config.totalSpinsAllowed,
        jackpot_enabled: config.jackpotEnabled,
        jackpot_prize: config.jackpotPrize,
        jackpot_trigger_rate: config.jackpotTriggerRate
      }
    );
  } else if (config.gameType === 'treasure_hunt') {
    await TreasureHunt.updateMany(
      { is_active: true, is_found: false },
      {
        rewards: {
          coins: config.rewardItems.find(i => i.itemType === 'coins')?.itemValue || 0,
          diamonds: config.rewardItems.find(i => i.itemType === 'diamonds')?.itemValue || 0,
          xp: config.rewardItems.find(i => i.itemType === 'xp')?.itemValue || 0,
          frames: config.rewardItems.filter(i => i.itemType === 'frame').map(i => i.itemId),
          badges: config.rewardItems.filter(i => i.itemType === 'badge').map(i => i.itemId),
          cars: config.rewardItems.filter(i => i.itemType === 'entry_car').map(i => i.itemId),
          specialEffects: config.rewardItems.filter(i => ['mount', 'entry_effect', 'avatar_decoration', 'chat_bubble', 'seat_frame'].includes(i.itemType)).map(i => i.itemId)
        }
      }
    );
  }
}