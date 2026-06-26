const LuckyDraw = require('../models/LuckyDraw');
const User = require('../models/User');
const UserEventProgress = require('../models/UserEventProgress');

// ─── ADMIN: CREATE LUCKY DRAW ──────────────────────────────────────────
exports.createLuckyDraw = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.draw_name || !payload.start_time || !payload.end_time) {
      return res.status(400).json({ success: false, message: 'Missing required fields: draw_name, start_time, end_time' });
    }
    if (!payload.segments || payload.segments.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 wheel segments required' });
    }

    const totalWeight = payload.segments.reduce((sum, s) => sum + (s.weight || 10), 0);
    if (totalWeight <= 0) {
      return res.status(400).json({ success: false, message: 'Total segment weight must be > 0' });
    }

    const luckyDraw = await LuckyDraw.create({
      ...payload,
      created_by: req.user.userId
    });

    res.status(201).json({ success: true, message: 'Lucky draw created', data: luckyDraw });
  } catch (error) {
    console.error('Create LuckyDraw Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create lucky draw' });
  }
};

// ─── PUBLIC: GET ACTIVE LUCKY DRAWS ────────────────────────────────────
exports.getActiveLuckyDraws = async (req, res) => {
  try {
    const now = new Date();
    
    // First try to get from RewardConfig (new system)
    const RewardConfig = require('../models/RewardConfig');
    const activeConfigs = await RewardConfig.find({
      gameType: 'lucky_spin',
      isActive: true,
      startTime: { $lte: now },
      endTime: { $gte: now }
    }).sort({ createdAt: -1 });

    if (activeConfigs.length > 0) {
      const configs = activeConfigs.map(config => ({
        _id: config._id,
        draw_name: config.configName,
        description: config.description,
        spin_cost_coins: config.spinCostCoins,
        spin_cost_diamonds: config.spinCostDiamonds,
        max_spins_per_user: config.maxSpinsPerUser,
        total_spins_allowed: config.totalSpinsAllowed,
        spins_used: config.totalSpinsUsed,
        segments: config.rewardItems.map(item => ({
          label: item.itemName,
          prize_type: item.itemType,
          prize_value: item.itemValue,
          prize_name: item.itemName,
          prize_id: item.itemId,
          weight: item.weight,
          color: config.tiers.find(t => t.tierName === item.tier)?.colorCode || '#FF6B6B'
        })),
        jackpot_enabled: config.jackpotEnabled,
        jackpot_prize: config.jackpotPrize,
        jackpot_current_pool: config.jackpotCurrentPool,
        jackpot_trigger_rate: config.jackpotTriggerRate,
        is_active: config.isActive,
        start_time: config.startTime,
        end_time: config.endTime,
        version: config.version
      }));

      return res.status(200).json({ success: true, data: configs });
    }

    // Fallback to old LuckyDraw system
    const draws = await LuckyDraw.find({
      is_active: true,
      start_time: { $lte: now },
      end_time: { $gte: now }
    }).select('-unique_users -recent_wins')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: draws });
  } catch (error) {
    console.error('Get LuckyDraws Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lucky draws' });
  }
};

// ─── PUBLIC: GET SINGLE LUCKY DRAW ─────────────────────────────────────
exports.getLuckyDrawById = async (req, res) => {
  try {
    const draw = await LuckyDraw.findById(req.params.id)
      .select('-unique_users');
    if (!draw) {
      return res.status(404).json({ success: false, message: 'Lucky draw not found' });
    }
    res.status(200).json({ success: true, data: draw });
  } catch (error) {
    console.error('Get LuckyDraw Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lucky draw' });
  }
};

// ─── PUBLIC: SPIN THE WHEEL ────────────────────────────────────────────
exports.spinWheel = async (req, res) => {
  try {
    const { drawId } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Try to fetch from RewardConfig first (new system)
    const RewardConfig = require('../models/RewardConfig');
    const config = await RewardConfig.findOne({
      _id: drawId,
      gameType: 'lucky_spin',
      isActive: true
    });

    if (config) {
      return await spinFromConfig(req, res, config, user);
    }

    // Fallback to old LuckyDraw system
    const draw = await LuckyDraw.findById(drawId);
    if (!draw || !draw.is_active) {
      return res.status(400).json({ success: false, message: 'Lucky draw not found or inactive' });
    }

    const now = new Date();
    if (now < draw.start_time || now > draw.end_time) {
      return res.status(400).json({ success: false, message: 'Lucky draw is not currently active' });
    }

    const userSpinCount = await UserEventProgress.countDocuments({
      userId,
      eventId: draw._id,
      taskId: null,
      is_completed: true
    });

    if (userSpinCount >= draw.max_spins_per_user) {
      return res.status(400).json({ success: false, message: 'Max spins reached for this draw' });
    }

    if (draw.spins_used >= draw.total_spins_allowed) {
      return res.status(400).json({ success: false, message: 'Draw is fully spun out' });
    }

    if (draw.spin_cost_coins > 0) {
      if ((user.coins || 0) < draw.spin_cost_coins) {
        return res.status(400).json({ success: false, message: 'Insufficient coins' });
      }
      user.coins -= draw.spin_cost_coins;
    }
    if (draw.spin_cost_diamonds > 0) {
      if ((user.diamonds || 0) < draw.spin_cost_diamonds) {
        return res.status(400).json({ success: false, message: 'Insufficient diamonds' });
      }
      user.diamonds -= draw.spin_cost_diamonds;
    }
    await user.save();

    const prizeIndex = weightedRandom(draw.segments);
    const wonSegment = draw.segments[prizeIndex];
    let prizeResult = {
      segment_index: prizeIndex,
      label: wonSegment.label,
      prize_type: wonSegment.prize_type,
      prize_value: wonSegment.prize_value,
      prize_name: wonSegment.prize_name,
      prize_id: wonSegment.prize_id || ''
    };

    let jackpotHit = false;
    if (draw.jackpot_enabled && Math.random() < draw.jackpot_trigger_rate) {
      jackpotHit = true;
      prizeResult = {
        segment_index: -1,
        label: draw.jackpot_prize.prize_name || 'JACKPOT',
        prize_type: draw.jackpot_prize.prize_type,
        prize_value: draw.jackpot_current_pool + draw.jackpot_prize.prize_value,
        prize_name: draw.jackpot_prize.prize_name || 'JACKPOT',
        prize_id: 'jackpot'
      };
    }

    await distributePrize(user, prizeResult);

    draw.total_spins += 1;
    draw.spins_used += 1;
    if (!draw.unique_users.some(id => id.toString() === userId.toString())) {
      draw.unique_users.push(userId);
      draw.total_users_played = draw.unique_users.length;
    }
    draw.recent_wins.unshift({
      userId: user._id,
      username: user.username || 'User',
      prize_label: prizeResult.label,
      prize_value: prizeResult.prize_value
    });
    if (draw.recent_wins.length > 50) draw.recent_wins = draw.recent_wins.slice(0, 50);
    await draw.save();

    await UserEventProgress.create({
      userId,
      eventId: draw._id,
      progress: 1,
      target_value: 1,
      is_completed: true,
      completed_at: new Date(),
      metadata: { prize: prizeResult }
    });

    if (draw.jackpot_enabled && !jackpotHit) {
      const poolContribution = Math.floor((draw.spin_cost_coins || 0) * 0.1);
      draw.jackpot_current_pool += poolContribution;
      await draw.save();
    }

    res.status(200).json({ success: true, data: { prize: prizeResult, jackpot_hit: jackpotHit } });
  } catch (error) {
    console.error('Spin Wheel Error:', error);
    res.status(500).json({ success: false, message: 'Failed to process spin' });
  }
};

// ─── ADMIN: GET ALL LUCKY DRAWS ────────────────────────────────────────
exports.adminGetAll = async (req, res) => {
  try {
    const draws = await LuckyDraw.find()
      .populate('created_by', 'name uid')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: draws });
  } catch (error) {
    console.error('Admin Get LuckyDraws Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lucky draws' });
  }
};

// ─── ADMIN: UPDATE LUCKY DRAW ──────────────────────────────────────────
exports.updateLuckyDraw = async (req, res) => {
  try {
    const draw = await LuckyDraw.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!draw) {
      return res.status(404).json({ success: false, message: 'Lucky draw not found' });
    }
    res.status(200).json({ success: true, data: draw });
  } catch (error) {
    console.error('Update LuckyDraw Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update lucky draw' });
  }
};

// ─── ADMIN: DELETE LUCKY DRAW ──────────────────────────────────────────
exports.deleteLuckyDraw = async (req, res) => {
  try {
    const draw = await LuckyDraw.findByIdAndDelete(req.params.id);
    if (!draw) {
      return res.status(404).json({ success: false, message: 'Lucky draw not found' });
    }
    res.status(200).json({ success: true, message: 'Lucky draw deleted' });
  } catch (error) {
    console.error('Delete LuckyDraw Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete lucky draw' });
  }
};

// ─── SPIN FROM REWARDCONFIG ─────────────────────────────────────────────
async function spinFromConfig(req, res, config, user) {
  try {
    const userId = user._id;
    const now = new Date();
    
    if (now < config.startTime || now > config.endTime) {
      return res.status(400).json({ success: false, message: 'Configuration is not currently active' });
    }

    if (config.totalSpinsAllowed > 0 && config.totalSpinsUsed >= config.totalSpinsAllowed) {
      return res.status(400).json({ success: false, message: 'Configuration has reached max spins' });
    }

    if (config.spinCostCoins > 0) {
      if ((user.coins || 0) < config.spinCostCoins) {
        return res.status(400).json({ success: false, message: 'Insufficient coins' });
      }
      user.coins -= config.spinCostCoins;
    }
    if (config.spinCostDiamonds > 0) {
      if ((user.diamonds || 0) < config.spinCostDiamonds) {
        return res.status(400).json({ success: false, message: 'Insufficient diamonds' });
      }
      user.diamonds -= config.spinCostDiamonds;
    }
    await user.save();

    const prizeIndex = weightedRandomFromConfig(config.rewardItems);
    const wonItem = config.rewardItems[prizeIndex];
    let prizeResult = {
      segment_index: prizeIndex,
      label: wonItem.itemName,
      prize_type: wonItem.itemType,
      prize_value: wonItem.itemValue,
      prize_name: wonItem.itemName,
      prize_id: wonItem.itemId,
      tier: wonItem.tier,
      probability: wonItem.probability
    };

    let jackpotHit = false;
    if (config.jackpotEnabled && Math.random() < config.jackpotTriggerRate) {
      jackpotHit = true;
      prizeResult = {
        segment_index: -1,
        label: config.jackpotPrize.prizeName || 'JACKPOT',
        prize_type: config.jackpotPrize.prizeType,
        prize_value: config.jackpotCurrentPool + config.jackpotPrize.prizeValue,
        prize_name: config.jackpotPrize.prizeName || 'JACKPOT',
        prize_id: 'jackpot',
        tier: 'mythic'
      };
    }

    await distributePrizeFromConfig(user, prizeResult);

    config.totalSpinsUsed += 1;
    config.totalCoinsIn += config.spinCostCoins;
    if (!jackpotHit) {
      config.totalRewardsOut += prizeResult.prize_value || 0;
    }
    await config.save();

    await UserEventProgress.create({
      userId,
      eventId: config._id,
      progress: 1,
      target_value: 1,
      is_completed: true,
      completed_at: new Date(),
      metadata: { 
        prize: prizeResult,
        configId: config._id,
        version: config.version
      }
    });

    if (config.jackpotEnabled && !jackpotHit) {
      const poolContribution = Math.floor((config.spinCostCoins || 0) * 0.1);
      config.jackpotCurrentPool += poolContribution;
      await config.save();
    }

    res.status(200).json({ 
      success: true, 
      data: { 
        reward: prizeResult, 
        jackpot_hit: jackpotHit,
        newBalance: { coins: user.coins, diamonds: user.diamonds }
      } 
    });
  } catch (error) {
    console.error('Spin from config error:', error);
    res.status(500).json({ success: false, message: 'Failed to process spin from config' });
  }
}

function weightedRandomFromConfig(rewardItems) {
  const totalWeight = rewardItems.reduce((sum, item) => sum + (item.weight || 10), 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < rewardItems.length; i++) {
    random -= (rewardItems[i].weight || 10);
    if (random <= 0) return i;
  }
  return rewardItems.length - 1;
}

async function distributePrizeFromConfig(user, prize) {
  switch (prize.prize_type) {
    case 'coins':
    case 'jackpot_coins':
      user.coins = (user.coins || 0) + (prize.prize_value || 0);
      break;
    case 'diamonds':
      user.diamonds = (user.diamonds || 0) + (prize.prize_value || 0);
      break;
    case 'xp':
      user.xp = (user.xp || 0) + (prize.prize_value || 0);
      break;
    case 'vip_days':
      user.vipExpiry = user.vipExpiry || new Date();
      if (user.vipExpiry < new Date()) user.vipExpiry = new Date();
      user.vipExpiry.setDate(user.vipExpiry.getDate() + (prize.prize_value || 1));
      break;
    case 'frame':
      user.unlockedFrames = user.unlockedFrames || [];
      if (prize.prize_id && !user.unlockedFrames.includes(prize.prize_id)) {
        user.unlockedFrames.push(prize.prize_id);
      }
      break;
    case 'badge':
      user.unlockedBadges = user.unlockedBadges || [];
      if (prize.prize_id && !user.unlockedBadges.includes(prize.prize_id)) {
        user.unlockedBadges.push(prize.prize_id);
      }
      break;
    case 'rocket':
      user.rockets = (user.rockets || 0) + (prize.prize_value || 1);
      break;
    case 'entry_car':
      user.unlockedEntryCars = user.unlockedEntryCars || [];
      if (prize.prize_id && !user.unlockedEntryCars.includes(prize.prize_id)) {
        user.unlockedEntryCars.push(prize.prize_id);
      }
      break;
    case 'mount':
    case 'entry_effect':
    case 'avatar_decoration':
    case 'chat_bubble':
    case 'seat_frame':
      if (!user.inventory) user.inventory = {};
      if (!user.inventory.customAssets) user.inventory.customAssets = [];
      user.inventory.customAssets.push({
        type: prize.prize_type,
        assetId: prize.prize_id,
        assetName: prize.prize_name,
        acquiredAt: new Date()
      });
      break;
    case 'nothing':
    default:
      break;
  }
  await user.save();
}

// ─── HELPERS ───────────────────────────────────────────────────────────
function weightedRandom(segments) {
  const totalWeight = segments.reduce((sum, s) => sum + (s.weight || 10), 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < segments.length; i++) {
    random -= (segments[i].weight || 10);
    if (random <= 0) return i;
  }
  return segments.length - 1;
}

async function distributePrize(user, prize) {
  switch (prize.prize_type) {
    case 'coins':
    case 'jackpot_coins':
      user.coins = (user.coins || 0) + (prize.prize_value || 0);
      break;
    case 'diamonds':
      user.diamonds = (user.diamonds || 0) + (prize.prize_value || 0);
      break;
    case 'xp':
      user.xp = (user.xp || 0) + (prize.prize_value || 0);
      break;
    case 'vip_days':
      user.vipExpiry = user.vipExpiry || new Date();
      if (user.vipExpiry < new Date()) user.vipExpiry = new Date();
      user.vipExpiry.setDate(user.vipExpiry.getDate() + (prize.prize_value || 1));
      break;
    case 'frame':
      user.unlockedFrames = user.unlockedFrames || [];
      if (prize.prize_id && !user.unlockedFrames.includes(prize.prize_id)) {
        user.unlockedFrames.push(prize.prize_id);
      }
      break;
    case 'badge':
      user.unlockedBadges = user.unlockedBadges || [];
      if (prize.prize_id && !user.unlockedBadges.includes(prize.prize_id)) {
        user.unlockedBadges.push(prize.prize_id);
      }
      break;
    case 'rocket':
      user.rockets = (user.rockets || 0) + (prize.prize_value || 1);
      break;
    case 'entry_car':
      user.unlockedEntryCars = user.unlockedEntryCars || [];
      if (prize.prize_id && !user.unlockedEntryCars.includes(prize.prize_id)) {
        user.unlockedEntryCars.push(prize.prize_id);
      }
      break;
    case 'nothing':
    default:
      break;
  }
  await user.save();
}