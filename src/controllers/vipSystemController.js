const mongoose = require('mongoose');
const VipSystem = require('../models/VipSystem');
const CosmeticItem = require('../models/CosmeticItem');
const User = require('../models/User');
const { VIP_XP_THRESHOLDS, SVIP_CONFIG } = require('../models/VipSystem');

// ============================================================
// VIP SYSTEM CONTROLLER
// Complete API for VIP 1-15, SVIP, Premium, Cosmetics, Missions
// ============================================================

// ───────────────────────────────────────────
// SECTION 1: VIP CORE (Levels, XP, Status)
// ───────────────────────────────────────────

exports.getUserVipStatus = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    let vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData) {
      vipData = await VipSystem.create({ user_uid: userId.toString() });
    }
    // Check premium expiry
    if (vipData.is_premium && vipData.premium_expiry && new Date() > vipData.premium_expiry) {
      vipData.is_premium = false;
      await vipData.save();
    }
    // Compute next level XP
    const nextLevelXP = VipSystem.getXPForNextLevel(vipData.vip_xp, vipData.vip_level);
    // Compute SVIP config
    const svipConfig = vipData.is_svip ? VipSystem.getSVIPConfig(vipData.svip_level) : null;
    res.status(200).json({
      success: true,
      data: {
        user_uid: vipData.user_uid,
        vip_level: vipData.vip_level,
        vip_xp: vipData.vip_xp,
        vip_xp_to_next_level: nextLevelXP,
        vip_level_progress: vipData.vip_level >= 15 ? 100 : Math.min(100, Math.floor((vipData.vip_xp / (VIP_XP_THRESHOLDS[vipData.vip_level + 1] || 1)) * 100)),
        is_svip: vipData.is_svip,
        svip_level: vipData.svip_level,
        svip_config: svipConfig,
        is_premium: vipData.is_premium,
        premium_expiry: vipData.premium_expiry,
        premium_days_remaining: vipData.premium_expiry ? Math.max(0, Math.floor((new Date(vipData.premium_expiry) - new Date()) / (1000 * 60 * 60 * 24))) : 0,
        active_cosmetics: vipData.active_cosmetics,
        unlocked_frames: vipData.unlocked_frames,
        unlocked_entrance_cars: vipData.unlocked_entrance_cars,
        unlocked_name_colors: vipData.unlocked_name_colors,
        unlocked_chat_bubbles: vipData.unlocked_chat_bubbles,
        unlocked_badges: vipData.unlocked_badges,
        vip_missions: vipData.vip_missions,
        total_recharge_amount: vipData.total_recharge_amount,
        total_gift_received_value: vipData.total_gift_received_value,
        total_gift_sent_value: vipData.total_gift_sent_value,
        vip_global_alerts_enabled: vipData.vip_global_alerts_enabled,
        xp_history: vipData.xp_history.slice(-50)
      }
    });
  } catch (error) {
    console.error('Get VIP Status Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VIP status' });
  }
};

exports.addVipXP = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { amount, source, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid XP amount required' });
    }
    let vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData) {
      vipData = await VipSystem.create({ user_uid: userId.toString() });
    }
    const previousLevel = vipData.vip_level;
    vipData.vip_xp += amount;
    vipData.vip_level = VipSystem.getLevelFromXP(vipData.vip_xp);
    vipData.vip_xp_to_next_level = VipSystem.getXPForNextLevel(vipData.vip_xp, vipData.vip_level);
    vipData.xp_history.push({
      amount,
      source: source || 'bonus',
      previous_level: previousLevel,
      new_level: vipData.vip_level,
      description: description || 'XP earned',
      created_at: new Date()
    });
    await vipData.save();
    const levelUp = vipData.vip_level > previousLevel;
    res.status(200).json({
      success: true,
      data: {
        vip_xp: vipData.vip_xp,
        vip_level: vipData.vip_level,
        previous_level: previousLevel,
        vip_xp_to_next_level: vipData.vip_xp_to_next_level,
        level_up: levelUp,
        level_up_rewards: levelUp ? getLevelUpRewards(vipData.vip_level) : null
      }
    });
  } catch (error) {
    console.error('Add VIP XP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to add VIP XP' });
  }
};

function getLevelUpRewards(level) {
  const rewards = {
    2: { coins: 100, frame_id: 'frame_vip2', frame_name: 'Silver Beginnings' },
    3: { coins: 200, name_color: '#C0C0C0', name_color_name: 'Silver Name' },
    4: { coins: 350, frame_id: 'frame_vip4', frame_name: 'Golden Aura' },
    5: { coins: 500, entrance_car_id: 'car_vip5', entrance_car_name: 'Sports Car', name_color: '#FFD700', name_color_name: 'Gold Name' },
    6: { coins: 700, chat_bubble_id: 'bubble_vip6', chat_bubble_name: 'Royal Bubble' },
    7: { coins: 1000, frame_id: 'frame_vip7', frame_name: 'Diamond Crown' },
    8: { coins: 1500, name_color: '#FF6347', name_color_name: 'Ruby Name' },
    9: { coins: 2000, entrance_car_id: 'car_vip9', entrance_car_name: 'Luxury Sedan' },
    10: { coins: 3000, frame_id: 'frame_vip10', frame_name: 'Platinum Glory', name_color: '#8A2BE2', name_color_name: 'Royal Purple Name' },
    11: { coins: 5000, chat_bubble_id: 'bubble_vip11', chat_bubble_name: 'Emperor Bubble', badge_id: 'badge_vip11', badge_name: 'VIP Elite Badge' },
    12: { coins: 7500, entrance_car_id: 'car_vip12', entrance_car_name: 'Helicopter Elite' },
    13: { coins: 10000, frame_id: 'frame_vip13', frame_name: 'Crystal Emperor', name_color_gradient: true, gradient_colors: ['#FFD700', '#FF4500'] },
    14: { coins: 15000, chat_bubble_id: 'bubble_vip14', chat_bubble_name: 'God Bubble', badge_id: 'badge_vip14', badge_name: 'Legendary VIP Badge' },
    15: { coins: 25000, entrance_car_id: 'car_vip15', entrance_car_name: 'Dragon King Entry', frame_id: 'frame_vip15', frame_name: 'Godly Frame', name_color: '#FF1493', name_color_name: 'Godly Name', badge_id: 'badge_vip15', badge_name: 'Supreme VIP Badge' }
  };
  return rewards[level] || null;
}

// ───────────────────────────────────────────
// SECTION 2: SVIP MANAGEMENT
// ───────────────────────────────────────────

exports.activateSVIP = async (req, res) => {
  try {
    const { user_uid, svip_level, package_name } = req.body;
    if (!user_uid || !svip_level || svip_level < 1 || svip_level > 5) {
      return res.status(400).json({ success: false, message: 'Valid user_uid and svip_level (1-5) required' });
    }
    const adminId = req.user.id || req.user.userId;
    let vipData = await VipSystem.findOne({ user_uid });
    if (!vipData) {
      vipData = await VipSystem.create({ user_uid });
    }
    vipData.is_svip = true;
    vipData.svip_level = svip_level;
    vipData.svip_activated_by = adminId;
    vipData.svip_activated_at = new Date();
    vipData.svip_package_name = package_name || `SVIP ${svip_level} Package`;
    // Set SVIP name color
    const svipConf = VipSystem.getSVIPConfig(svip_level);
    if (svipConf) {
      vipData.active_cosmetics.name_color = svipConf.name_color;
    }
    await vipData.save();
    // Update user profile with SVIP status
    await User.findByIdAndUpdate(user_uid, {
      isSvip: true,
      svipLevel: svip_level
    });
    const svipConfig = VipSystem.getSVIPConfig(svip_level);
    res.status(200).json({
      success: true,
      message: `SVIP Level ${svip_level} activated successfully!`,
      data: {
        is_svip: true,
        svip_level,
        svip_config: svipConfig
      }
    });
  } catch (error) {
    console.error('Activate SVIP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to activate SVIP' });
  }
};

exports.deactivateSVIP = async (req, res) => {
  try {
    const { user_uid } = req.body;
    if (!user_uid) {
      return res.status(400).json({ success: false, message: 'user_uid required' });
    }
    const vipData = await VipSystem.findOne({ user_uid });
    if (!vipData) {
      return res.status(404).json({ success: false, message: 'VIP data not found' });
    }
    vipData.is_svip = false;
    vipData.svip_level = 0;
    vipData.svip_package_name = '';
    if (vipData.active_cosmetics.name_color === '#FFD700' ||
        vipData.active_cosmetics.name_color === '#FF4500' ||
        vipData.active_cosmetics.name_color === '#8A2BE2' ||
        vipData.active_cosmetics.name_color === '#00CED1' ||
        vipData.active_cosmetics.name_color === '#FF1493') {
      vipData.active_cosmetics.name_color = '#FFFFFF';
    }
    await vipData.save();
    await User.findByIdAndUpdate(user_uid, {
      isSvip: false,
      svipLevel: 0
    });
    res.status(200).json({ success: true, message: 'SVIP deactivated' });
  } catch (error) {
    console.error('Deactivate SVIP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate SVIP' });
  }
};

exports.listSVIPUsers = async (req, res) => {
  try {
    const svipUsers = await VipSystem.find({ is_svip: true })
      .sort({ svip_level: -1, vip_level: -1 })
      .populate('svip_activated_by', 'username fullName')
      .lean();
    const enriched = await Promise.all(svipUsers.map(async (sv) => {
      const user = await User.findById(sv.user_uid).select('username fullName profilePic coins').lean();
      return { ...sv, user_details: user };
    }));
    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error('List SVIP Users Error:', error);
    res.status(500).json({ success: false, message: 'Failed to list SVIP users' });
  }
};

// ───────────────────────────────────────────
// SECTION 3: PREMIUM SUBSCRIPTION
// ───────────────────────────────────────────

exports.purchasePremium = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { months } = req.body;
    const monthsToAdd = parseInt(months) || 1;
    const premiumCost = 500 * monthsToAdd; // 500 coins per month
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if ((user.coins || 0) < premiumCost) {
      return res.status(400).json({ success: false, message: `Insufficient coins. Need ${premiumCost} coins for ${monthsToAdd} month(s)` });
    }
    user.coins -= premiumCost;
    await user.save();
    let vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData) {
      vipData = await VipSystem.create({ user_uid: userId.toString() });
    }
    const now = new Date();
    if (vipData.is_premium && vipData.premium_expiry && vipData.premium_expiry > now) {
      vipData.premium_expiry.setMonth(vipData.premium_expiry.getMonth() + monthsToAdd);
    } else {
      vipData.is_premium = true;
      vipData.premium_expiry = new Date(now);
      vipData.premium_expiry.setMonth(vipData.premium_expiry.getMonth() + monthsToAdd);
    }
    vipData.premium_last_renewed = now;
    vipData.premium_auto_renew = true;
    await vipData.save();
    // Also add VIP XP for premium purchase
    const xpGain = 100 * monthsToAdd;
    vipData.vip_xp += xpGain;
    const previousLevel = vipData.vip_level;
    vipData.vip_level = VipSystem.getLevelFromXP(vipData.vip_xp);
    vipData.xp_history.push({
      amount: xpGain,
      source: 'bonus',
      previous_level: previousLevel,
      new_level: vipData.vip_level,
      description: `Premium subscription for ${monthsToAdd} month(s)`,
      created_at: new Date()
    });
    await vipData.save();
    res.status(200).json({
      success: true,
      message: `Premium activated for ${monthsToAdd} month(s)!`,
      data: {
        is_premium: true,
        premium_expiry: vipData.premium_expiry,
        premium_days_remaining: Math.max(0, Math.floor((vipData.premium_expiry - new Date()) / (1000 * 60 * 60 * 24))),
        coins_remaining: user.coins,
        vip_xp: vipData.vip_xp,
        vip_level: vipData.vip_level
      }
    });
  } catch (error) {
    console.error('Purchase Premium Error:', error);
    res.status(500).json({ success: false, message: 'Failed to purchase premium' });
  }
};

exports.cancelPremiumAutoRenew = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData) {
      return res.status(404).json({ success: false, message: 'VIP data not found' });
    }
    vipData.premium_auto_renew = false;
    await vipData.save();
    res.status(200).json({ success: true, message: 'Auto-renew cancelled' });
  } catch (error) {
    console.error('Cancel Premium Auto Renew Error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel auto-renew' });
  }
};

// ───────────────────────────────────────────
// SECTION 4: COSMETICS (Frames, Cars, Colors, Bubbles, Badges)
// ───────────────────────────────────────────

exports.getAvailableCosmetics = async (req, res) => {
  try {
    const { item_type } = req.query;
    const filter = { is_active: true };
    if (item_type) filter.item_type = item_type;
    const items = await CosmeticItem.find(filter).sort({ display_order: 1, rarity: 1 }).lean();
    const userId = req.user.id || req.user.userId;
    const vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    const enrichedItems = items.map(item => {
      const meetsVIPReq = item.vip_level_required <= (vipData?.vip_level || 0);
      const meetsSVIPReq = !item.svip_level_required || item.svip_level_required <= (vipData?.svip_level || 0);
      const hasPremiumAccess = !item.is_premium_exclusive || vipData?.is_premium;
      const hasSVIPAccess = !item.is_svip_exclusive || vipData?.is_svip;
      const canAccess = meetsVIPReq && meetsSVIPReq && hasPremiumAccess && hasSVIPAccess;
      const isOwned = checkItemOwned(vipData, item);
      return { ...item, can_access: canAccess, is_owned: isOwned };
    });
    res.status(200).json({ success: true, data: enrichedItems });
  } catch (error) {
    console.error('Get Available Cosmetics Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cosmetics' });
  }
};

function checkItemOwned(vipData, item) {
  if (!vipData) return false;
  switch (item.item_type) {
    case 'frame':
      return vipData.unlocked_frames.some(f => f.frame_id === item.item_id);
    case 'entrance_car':
      return vipData.unlocked_entrance_cars.some(c => c.car_id === item.item_id);
    case 'name_color':
      return vipData.unlocked_name_colors.some(c => c.color_id === item.item_id);
    case 'chat_bubble':
      return vipData.unlocked_chat_bubbles.some(b => b.bubble_id === item.item_id);
    case 'badge':
      return vipData.unlocked_badges.some(b => b.badge_id === item.item_id);
    default:
      return false;
  }
}

exports.purchaseCosmetic = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { item_id } = req.body;
    if (!item_id) {
      return res.status(400).json({ success: false, message: 'item_id required' });
    }
    const cosmetic = await CosmeticItem.findOne({ item_id, is_active: true });
    if (!cosmetic) {
      return res.status(404).json({ success: false, message: 'Cosmetic item not found' });
    }
    const user = await User.findById(userId);
    let vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData) {
      vipData = await VipSystem.create({ user_uid: userId.toString() });
    }
    // Check VIP level requirement
    if (cosmetic.vip_level_required > 0 && (vipData.vip_level < cosmetic.vip_level_required)) {
      return res.status(403).json({ success: false, message: `VIP Level ${cosmetic.vip_level_required} required` });
    }
    // Check SVIP requirement
    if (cosmetic.svip_level_required > 0 && (!vipData.is_svip || vipData.svip_level < cosmetic.svip_level_required)) {
      return res.status(403).json({ success: false, message: `SVIP Level ${cosmetic.svip_level_required} required` });
    }
    // Check premium exclusive
    if (cosmetic.is_premium_exclusive && !vipData.is_premium) {
      return res.status(403).json({ success: false, message: 'Premium subscription required' });
    }
    // Check SVIP exclusive
    if (cosmetic.is_svip_exclusive && !vipData.is_svip) {
      return res.status(403).json({ success: false, message: 'SVIP status required' });
    }
    // Check if already owned
    if (checkItemOwned(vipData, cosmetic)) {
      return res.status(400).json({ success: false, message: 'Item already owned' });
    }
    // Check coin balance
    if ((user.coins || 0) < cosmetic.coin_cost) {
      return res.status(400).json({ success: false, message: `Insufficient coins. Need ${cosmetic.coin_cost}` });
    }
    // Process purchase
    user.coins -= cosmetic.coin_cost;
    await user.save();
    // Add to unlocked collection
    addItemToCollection(vipData, cosmetic);
    vipData.vip_shop_purchases.push({
      item_id: cosmetic.item_id,
      item_name: cosmetic.item_name,
      item_type: cosmetic.item_type,
      cost_coins: cosmetic.coin_cost,
      purchased_at: new Date(),
      vip_level_required: cosmetic.vip_level_required
    });
    await vipData.save();
    // Check limited edition
    if (cosmetic.is_limited_edition && cosmetic.limited_edition_quantity > 0) {
      cosmetic.limited_edition_sold += 1;
      if (cosmetic.limited_edition_sold >= cosmetic.limited_edition_quantity) {
        cosmetic.is_active = false;
      }
      await cosmetic.save();
    }
    res.status(200).json({
      success: true,
      message: `${cosmetic.item_name} purchased successfully!`,
      data: {
        item_type: cosmetic.item_type,
        item_id: cosmetic.item_id,
        item_name: cosmetic.item_name,
        coins_spent: cosmetic.coin_cost,
        coins_remaining: user.coins,
        unlocked_item: getItemDetailsByType(vipData, cosmetic)
      }
    });
  } catch (error) {
    console.error('Purchase Cosmetic Error:', error);
    res.status(500).json({ success: false, message: 'Failed to purchase cosmetic' });
  }
};

function addItemToCollection(vipData, cosmetic) {
  const now = new Date();
  switch (cosmetic.item_type) {
    case 'frame':
      vipData.unlocked_frames.push({ frame_id: cosmetic.item_id, frame_name: cosmetic.item_name, frame_url: cosmetic.image_url || '', unlocked_at: now, is_animated: cosmetic.is_animated || false });
      break;
    case 'entrance_car':
      vipData.unlocked_entrance_cars.push({ car_id: cosmetic.item_id, car_name: cosmetic.item_name, car_animation_url: cosmetic.animation_url || '', unlocked_at: now, animation_duration_ms: cosmetic.animation_duration_ms || 3000 });
      break;
    case 'name_color':
      vipData.unlocked_name_colors.push({ color_id: cosmetic.item_id, color_name: cosmetic.item_name, hex_code: cosmetic.hex_code || '#FFFFFF', is_gradient: cosmetic.is_gradient || false, gradient_colors: cosmetic.gradient_colors || [], unlocked_at: now });
      break;
    case 'chat_bubble':
      vipData.unlocked_chat_bubbles.push({ bubble_id: cosmetic.item_id, bubble_name: cosmetic.item_name, bubble_url: cosmetic.image_url || '', unlocked_at: now, is_animated: cosmetic.is_animated || false });
      break;
    case 'badge':
      vipData.unlocked_badges.push({ badge_id: cosmetic.item_id, badge_name: cosmetic.item_name, badge_url: cosmetic.image_url || '', unlocked_at: now });
      break;
  }
}

function getItemDetailsByType(vipData, cosmetic) {
  switch (cosmetic.item_type) {
    case 'frame':
      return vipData.unlocked_frames.find(f => f.frame_id === cosmetic.item_id);
    case 'entrance_car':
      return vipData.unlocked_entrance_cars.find(c => c.car_id === cosmetic.item_id);
    case 'name_color':
      return vipData.unlocked_name_colors.find(c => c.color_id === cosmetic.item_id);
    case 'chat_bubble':
      return vipData.unlocked_chat_bubbles.find(b => b.bubble_id === cosmetic.item_id);
    case 'badge':
      return vipData.unlocked_badges.find(b => b.badge_id === cosmetic.item_id);
    default:
      return null;
  }
}

exports.applyCosmetic = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { item_id, item_type, apply } = req.body;
    if (!item_id || !item_type) {
      return res.status(400).json({ success: false, message: 'item_id and item_type required' });
    }
    let vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData) {
      vipData = await VipSystem.create({ user_uid: userId.toString() });
    }
    const isOwned = checkItemOwned(vipData, { item_id, item_type });
    if (!isOwned) {
      return res.status(403).json({ success: false, message: 'Item not owned' });
    }
    if (apply === false) {
      // Remove the cosmetic (reset to default)
      switch (item_type) {
        case 'frame': vipData.active_cosmetics.frame_id = ''; break;
        case 'entrance_car': vipData.active_cosmetics.entrance_car_id = ''; break;
        case 'name_color': vipData.active_cosmetics.name_color = '#FFFFFF'; break;
        case 'chat_bubble': vipData.active_cosmetics.chat_bubble_id = ''; break;
        case 'badge': vipData.active_cosmetics.badge_id = ''; break;
      }
    } else {
      switch (item_type) {
        case 'frame': vipData.active_cosmetics.frame_id = item_id; break;
        case 'entrance_car': vipData.active_cosmetics.entrance_car_id = item_id; break;
        case 'name_color': {
          const colorItem = vipData.unlocked_name_colors.find(c => c.color_id === item_id);
          vipData.active_cosmetics.name_color = colorItem ? colorItem.hex_code : '#FFFFFF';
          break;
        }
        case 'chat_bubble': vipData.active_cosmetics.chat_bubble_id = item_id; break;
        case 'badge': vipData.active_cosmetics.badge_id = item_id; break;
      }
    }
    await vipData.save();
    res.status(200).json({
      success: true,
      message: apply === false ? 'Cosmetic removed' : 'Cosmetic applied',
      data: { active_cosmetics: vipData.active_cosmetics }
    });
  } catch (error) {
    console.error('Apply Cosmetic Error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply cosmetic' });
  }
};

// ───────────────────────────────────────────
// SECTION 5: VIP MISSIONS
// ───────────────────────────────────────────

exports.getVipMissions = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    let vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData) {
      vipData = await VipSystem.create({ user_uid: userId.toString() });
    }
    // Auto-generate daily missions if none active
    const activeMissions = vipData.vip_missions.filter(m => !m.is_completed && (!m.expires_at || new Date(m.expires_at) > new Date()));
    if (activeMissions.length === 0 && vipData.vip_level > 0) {
      await generateDailyMissions(vipData);
    }
    res.status(200).json({
      success: true,
      data: {
        missions: vipData.vip_missions.filter(m => !m.expires_at || new Date(m.expires_at) > new Date()),
        completed_count: vipData.vip_missions.filter(m => m.is_completed).length
      }
    });
  } catch (error) {
    console.error('Get VIP Missions Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch missions' });
  }
};

async function generateDailyMissions(vipData) {
  const missions = [
    { mission_name: 'Daily Recharge', type: 'recharge', target: 1000, reward_type: 'vip_xp', reward_value: 50 },
    { mission_name: 'Gift a Friend', type: 'gift', target: 500, reward_type: 'vip_xp', reward_value: 30 },
    { mission_name: 'Play a Game', type: 'gaming', target: 3, reward_type: 'coins', reward_value: 200 },
    { mission_name: 'Send 10 Messages', type: 'social', target: 10, reward_type: 'vip_xp', reward_value: 20 },
    { mission_name: 'Visit 5 Rooms', type: 'social', target: 5, reward_type: 'coins', reward_value: 100 },
  ];
  const expiresAt = new Date();
  expiresAt.setHours(23, 59, 59, 999);
  const sortedMissions = missions.sort(() => Math.random() - 0.5).slice(0, 3);
  sortedMissions.forEach(m => {
    vipData.vip_missions.push({
      mission_id: new mongoose.Types.ObjectId().toString(),
      mission_name: m.mission_name,
      mission_type: m.type,
      target_value: m.target,
      current_progress: 0,
      is_completed: false,
      reward_claimed: false,
      reward_type: m.reward_type,
      reward_value: m.reward_value,
      expires_at: expiresAt,
      started_at: new Date()
    });
  });
}

exports.updateMissionProgress = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { mission_id, progress_amount } = req.body;
    if (!mission_id || !progress_amount) {
      return res.status(400).json({ success: false, message: 'mission_id and progress_amount required' });
    }
    const vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData) {
      return res.status(404).json({ success: false, message: 'VIP data not found' });
    }
    const mission = vipData.vip_missions.id(mission_id);
    if (!mission) {
      return res.status(404).json({ success: false, message: 'Mission not found' });
    }
    if (mission.is_completed) {
      return res.status(400).json({ success: false, message: 'Mission already completed' });
    }
    mission.current_progress += progress_amount;
    if (mission.current_progress >= mission.target_value) {
      mission.current_progress = mission.target_value;
      mission.is_completed = true;
      mission.completed_at = new Date();
    }
    await vipData.save();
    res.status(200).json({
      success: true,
      data: {
        mission_id: mission.mission_id,
        mission_name: mission.mission_name,
        current_progress: mission.current_progress,
        target_value: mission.target_value,
        is_completed: mission.is_completed,
        progress_percent: Math.min(100, Math.floor((mission.current_progress / mission.target_value) * 100))
      }
    });
  } catch (error) {
    console.error('Update Mission Progress Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update mission progress' });
  }
};

exports.claimMissionReward = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { mission_id } = req.body;
    if (!mission_id) {
      return res.status(400).json({ success: false, message: 'mission_id required' });
    }
    const vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData) {
      return res.status(404).json({ success: false, message: 'VIP data not found' });
    }
    const mission = vipData.vip_missions.id(mission_id);
    if (!mission) {
      return res.status(404).json({ success: false, message: 'Mission not found' });
    }
    if (!mission.is_completed) {
      return res.status(400).json({ success: false, message: 'Mission not yet completed' });
    }
    if (mission.reward_claimed) {
      return res.status(400).json({ success: false, message: 'Reward already claimed' });
    }
    mission.reward_claimed = true;
    const user = await User.findById(userId);
    if (mission.reward_type === 'coins') {
      user.coins += mission.reward_value;
      await user.save();
    } else if (mission.reward_type === 'vip_xp') {
      const previousLevel = vipData.vip_level;
      vipData.vip_xp += mission.reward_value;
      vipData.vip_level = VipSystem.getLevelFromXP(vipData.vip_xp);
      vipData.xp_history.push({
        amount: mission.reward_value,
        source: 'mission',
        previous_level: previousLevel,
        new_level: vipData.vip_level,
        description: `Reward from mission: ${mission.mission_name}`,
        created_at: new Date()
      });
    }
    await vipData.save();
    res.status(200).json({
      success: true,
      message: `Reward claimed: ${mission.reward_value} ${mission.reward_type}`,
      data: {
        reward_type: mission.reward_type,
        reward_value: mission.reward_value,
        vip_xp: vipData.vip_xp,
        vip_level: vipData.vip_level,
        coins: user.coins
      }
    });
  } catch (error) {
    console.error('Claim Mission Reward Error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim reward' });
  }
};

// ───────────────────────────────────────────
// SECTION 6: VIP SHOP (Exclusive Store)
// ───────────────────────────────────────────

exports.getVIPShopItems = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    const userVIPLevel = vipData?.vip_level || 0;
    const isSVIP = vipData?.is_svip || false;
    const svipLevel = vipData?.svip_level || 0;
    const isPremium = vipData?.is_premium || false;
    const items = await CosmeticItem.find({
      is_active: true,
      $or: [
        { vip_level_required: { $lte: userVIPLevel } },
        { svip_level_required: { $gt: 0, $lte: svipLevel } },
        { is_premium_exclusive: isPremium },
        { is_svip_exclusive: isSVIP }
      ]
    }).sort({ rarity: 1, display_order: 1 }).lean();
    const enrichedItems = items.map(item => ({
      ...item,
      is_owned: checkItemOwned(vipData, item),
      meets_vip_req: item.vip_level_required <= userVIPLevel,
      meets_svip_req: !item.svip_level_required || item.svip_level_required <= svipLevel,
      has_premium: !item.is_premium_exclusive || isPremium,
      has_svip: !item.is_svip_exclusive || isSVIP
    }));
    res.status(200).json({ success: true, data: enrichedItems });
  } catch (error) {
    console.error('Get VIP Shop Items Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VIP shop items' });
  }
};

// ───────────────────────────────────────────
// SECTION 7: VIP ENTRY EFFECTS (Socket Events)
// ───────────────────────────────────────────

exports.triggerVIPEntry = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { room_id } = req.body;
    if (!room_id) {
      return res.status(400).json({ success: false, message: 'room_id required' });
    }
    const vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    const user = await User.findById(userId).select('username fullName profilePic vipLevel isSvip svipLevel').lean();
    if (!vipData || (vipData.vip_level < 5 && !vipData.is_svip)) {
      return res.status(403).json({ success: false, message: 'VIP Level 5+ or SVIP required for entry effects' });
    }
    const entryEffect = vipData.active_cosmetics.entrance_car_id ?
      await CosmeticItem.findOne({ item_id: vipData.active_cosmetics.entrance_car_id }).lean() :
      null;
    const io = req.app.get('socketio');
    if (io) {
      io.to(room_id).emit('vip_entry', {
        user_uid: userId.toString(),
        username: user?.username || 'Unknown',
        fullName: user?.fullName || '',
        profilePic: user?.profilePic || '',
        vip_level: vipData.vip_level,
        is_svip: vipData.is_svip,
        svip_level: vipData.svip_level,
        entrance_effect: entryEffect ? {
          car_id: entryEffect.item_id,
          car_name: entryEffect.item_name,
          animation_url: entryEffect.animation_url || '',
          animation_duration_ms: entryEffect.animation_duration_ms || 3000,
          is_animated: entryEffect.is_animated || false
        } : null,
        frame_id: vipData.active_cosmetics.frame_id,
        name_color: vipData.active_cosmetics.name_color,
        badge_id: vipData.active_cosmetics.badge_id
      });
      // Send global notification for SVIP users
      if (vipData.is_svip && vipData.vip_global_alerts_enabled) {
        io.emit('vip_global_alert', {
          type: 'svip_entry',
          username: user?.username || 'Unknown',
          svip_level: vipData.svip_level,
          room_id,
          message: `👑 The King ${user?.username || 'Unknown'} has entered Room ${room_id}!`,
          timestamp: new Date()
        });
      }
    }
    res.status(200).json({ success: true, message: 'VIP entry triggered', data: { entry_effect: entryEffect } });
  } catch (error) {
    console.error('Trigger VIP Entry Error:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger VIP entry' });
  }
};

// ───────────────────────────────────────────
// SECTION 8: ADMIN BULK OPERATIONS
// ───────────────────────────────────────────

exports.adminUpdateVipLevel = async (req, res) => {
  try {
    const { user_uid, vip_level, vip_xp } = req.body;
    if (!user_uid) {
      return res.status(400).json({ success: false, message: 'user_uid required' });
    }
    let vipData = await VipSystem.findOne({ user_uid });
    if (!vipData) {
      vipData = await VipSystem.create({ user_uid });
    }
    if (vip_level !== undefined) {
      if (vip_level < 0 || vip_level > 15) {
        return res.status(400).json({ success: false, message: 'VIP level must be 0-15' });
      }
      vipData.vip_level = vip_level;
      vipData.vip_xp = vip_xp !== undefined ? vip_xp : VipSystem.getXPForLevel(vip_level);
    }
    if (vip_xp !== undefined) {
      vipData.vip_xp = vip_xp;
      vipData.vip_level = VipSystem.getLevelFromXP(vip_xp);
    }
    await vipData.save();
    res.status(200).json({ success: true, message: 'VIP data updated', data: { vip_level: vipData.vip_level, vip_xp: vipData.vip_xp } });
  } catch (error) {
    console.error('Admin Update VIP Level Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update VIP' });
  }
};

exports.adminListAllVIP = async (req, res) => {
  try {
    const { page = 1, limit = 20, vip_level, is_svip, is_premium, sort_by = 'vip_level', sort_order = 'desc' } = req.query;
    const filter = {};
    if (vip_level) filter.vip_level = parseInt(vip_level);
    if (is_svip === 'true') filter.is_svip = true;
    if (is_svip === 'false') filter.is_svip = false;
    if (is_premium === 'true') filter.is_premium = true;
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'desc' ? -1 : 1;
    const total = await VipSystem.countDocuments(filter);
    const vipUsers = await VipSystem.find(filter)
      .sort(sortObj)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();
    const enriched = await Promise.all(vipUsers.map(async (vu) => {
      const user = await User.findById(vu.user_uid).select('username fullName profilePic coins phoneNumber').lean();
      return { ...vu, user_details: user };
    }));
    res.status(200).json({
      success: true,
      data: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin List All VIP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to list VIP users' });
  }
};

exports.adminManageCosmetics = async (req, res) => {
  try {
    const { action, item_data } = req.body;
    if (!action || !item_data) {
      return res.status(400).json({ success: false, message: 'action and item_data required' });
    }
    if (action === 'create') {
      const item = await CosmeticItem.create(item_data);
      return res.status(201).json({ success: true, message: 'Cosmetic item created', data: item });
    }
    if (action === 'update') {
      if (!item_data.item_id) return res.status(400).json({ success: false, message: 'item_id required for update' });
      const item = await CosmeticItem.findOneAndUpdate(
        { item_id: item_data.item_id },
        { $set: item_data },
        { new: true }
      );
      if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
      return res.status(200).json({ success: true, message: 'Cosmetic item updated', data: item });
    }
    if (action === 'delete') {
      if (!item_data.item_id) return res.status(400).json({ success: false, message: 'item_id required for delete' });
      await CosmeticItem.findOneAndDelete({ item_id: item_data.item_id });
      return res.status(200).json({ success: true, message: 'Cosmetic item deleted' });
    }
    if (action === 'list') {
      const items = await CosmeticItem.find().sort({ item_type: 1, display_order: 1 });
      return res.status(200).json({ success: true, data: items });
    }
    res.status(400).json({ success: false, message: 'Invalid action' });
  } catch (error) {
    console.error('Admin Manage Cosmetics Error:', error);
    res.status(500).json({ success: false, message: 'Failed to manage cosmetics' });
  }
};

// ───────────────────────────────────────────
// SECTION 9: VIP LEADERBOARD
// ───────────────────────────────────────────

exports.getVIPLeaderboard = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const vipUsers = await VipSystem.find({ vip_level: { $gt: 0 } })
      .sort({ vip_level: -1, vip_xp: -1 })
      .limit(parseInt(limit))
      .lean();
    const enriched = await Promise.all(vipUsers.map(async (vu, index) => {
      const user = await User.findById(vu.user_uid).select('username fullName profilePic').lean();
      return {
        rank: index + 1,
        user_uid: vu.user_uid,
        username: user?.username || 'Unknown',
        fullName: user?.fullName || '',
        profilePic: user?.profilePic || '',
        vip_level: vu.vip_level,
        vip_xp: vu.vip_xp,
        is_svip: vu.is_svip,
        svip_level: vu.svip_level,
        is_premium: vu.is_premium,
        total_recharge_amount: vu.total_recharge_amount
      };
    }));
    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get VIP Leaderboard Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VIP leaderboard' });
  }
};

// ───────────────────────────────────────────
// SECTION 10: PREMIUM DAILY BONUS
// ───────────────────────────────────────────

exports.claimPremiumDailyBonus = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const vipData = await VipSystem.findOne({ user_uid: userId.toString() });
    if (!vipData || !vipData.is_premium) {
      return res.status(403).json({ success: false, message: 'Premium subscription required' });
    }
    if (vipData.premium_expiry && new Date() > vipData.premium_expiry) {
      vipData.is_premium = false;
      await vipData.save();
      return res.status(403).json({ success: false, message: 'Premium has expired' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastClaimed = vipData.premium_last_renewed ? new Date(vipData.premium_last_renewed) : null;
    if (lastClaimed && lastClaimed >= today) {
      return res.status(400).json({ success: false, message: 'Daily bonus already claimed today' });
    }
    const premiumDailyBonus = 50; // 50 coins daily
    const user = await User.findById(userId);
    user.coins += premiumDailyBonus;
    await user.save();
    vipData.premium_last_renewed = new Date();
    vipData.xp_history.push({
      amount: 10,
      source: 'bonus',
      previous_level: vipData.vip_level,
      new_level: vipData.vip_level,
      description: 'Premium daily bonus',
      created_at: new Date()
    });
    vipData.vip_xp += 10;
    await vipData.save();
    res.status(200).json({
      success: true,
      message: `Premium daily bonus of ${premiumDailyBonus} coins claimed!`,
      data: { coins_added: premiumDailyBonus, coins_total: user.coins, vip_xp_added: 10 }
    });
  } catch (error) {
    console.error('Claim Premium Daily Bonus Error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim daily bonus' });
  }
};

// ───────────────────────────────────────────
// INIT: Create default cosmetic items on first run
// ───────────────────────────────────────────

exports.initializeDefaultCosmetics = async () => {
  try {
    const existingCount = await CosmeticItem.countDocuments();
    if (existingCount > 0) return;
    const defaults = [
      // Frames
      { item_id: 'frame_vip2', item_type: 'frame', item_name: 'Silver Beginnings', description: 'VIP Level 2 frame', coin_cost: 0, vip_level_required: 2, is_animated: false, rarity: 'common', display_order: 1 },
      { item_id: 'frame_vip4', item_type: 'frame', item_name: 'Golden Aura', description: 'VIP Level 4 frame', coin_cost: 0, vip_level_required: 4, is_animated: true, rarity: 'rare', display_order: 2 },
      { item_id: 'frame_vip7', item_type: 'frame', item_name: 'Diamond Crown', description: 'VIP Level 7 frame', coin_cost: 5000, vip_level_required: 7, is_animated: true, rarity: 'epic', display_order: 3 },
      { item_id: 'frame_vip10', item_type: 'frame', item_name: 'Platinum Glory', description: 'VIP Level 10 frame', coin_cost: 15000, vip_level_required: 10, is_animated: true, rarity: 'legendary', display_order: 4 },
      { item_id: 'frame_vip13', item_type: 'frame', item_name: 'Crystal Emperor', description: 'VIP Level 13 frame', coin_cost: 30000, vip_level_required: 13, is_animated: true, rarity: 'legendary', display_order: 5 },
      { item_id: 'frame_vip15', item_type: 'frame', item_name: 'Godly Frame', description: 'VIP Level 15 frame - ultimate status', coin_cost: 100000, vip_level_required: 15, is_animated: true, rarity: 'godly', display_order: 6 },
      { item_id: 'frame_svip1', item_type: 'frame', item_name: 'SVIP Gold Frame', description: 'SVIP Level 1 exclusive', coin_cost: 0, svip_level_required: 1, is_svip_exclusive: true, is_animated: true, rarity: 'legendary', display_order: 7 },
      { item_id: 'frame_svip3', item_type: 'frame', item_name: 'SVIP Emperor Frame', description: 'SVIP Level 3 exclusive', coin_cost: 0, svip_level_required: 3, is_svip_exclusive: true, is_animated: true, rarity: 'godly', display_order: 8 },
      // Entrance Cars
      { item_id: 'car_vip5', item_type: 'entrance_car', item_name: 'Sports Car', description: 'VIP Level 5 entry effect', coin_cost: 8000, vip_level_required: 5, animation_duration_ms: 3000, rarity: 'rare', display_order: 10 },
      { item_id: 'car_vip9', item_type: 'entrance_car', item_name: 'Luxury Sedan', description: 'VIP Level 9 entry effect', coin_cost: 20000, vip_level_required: 9, animation_duration_ms: 3500, rarity: 'epic', display_order: 11 },
      { item_id: 'car_vip12', item_type: 'entrance_car', item_name: 'Helicopter Elite', description: 'VIP Level 12 entry effect', coin_cost: 50000, vip_level_required: 12, animation_duration_ms: 4000, rarity: 'legendary', display_order: 12 },
      { item_id: 'car_vip15', item_type: 'entrance_car', item_name: 'Dragon King Entry', description: 'VIP Level 15 entry - ENTER THE DRAGON!', coin_cost: 150000, vip_level_required: 15, animation_duration_ms: 5000, rarity: 'godly', display_order: 13 },
      { item_id: 'car_svip2', item_type: 'entrance_car', item_name: 'SVIP Helicopter', description: 'SVIP Level 2 entry effect', coin_cost: 0, svip_level_required: 2, is_svip_exclusive: true, animation_duration_ms: 4000, rarity: 'legendary', display_order: 14 },
      // Name Colors
      { item_id: 'color_silver', item_type: 'name_color', item_name: 'Silver Name', description: 'VIP Level 3 name color', coin_cost: 0, vip_level_required: 3, hex_code: '#C0C0C0', is_gradient: false, display_order: 20 },
      { item_id: 'color_gold', item_type: 'name_color', item_name: 'Gold Name', description: 'VIP Level 5 name color', coin_cost: 0, vip_level_required: 5, hex_code: '#FFD700', is_gradient: false, display_order: 21 },
      { item_id: 'color_ruby', item_type: 'name_color', item_name: 'Ruby Name', description: 'VIP Level 8 name color', coin_cost: 3000, vip_level_required: 8, hex_code: '#FF6347', is_gradient: false, display_order: 22 },
      { item_id: 'color_purple_royal', item_type: 'name_color', item_name: 'Royal Purple Name', description: 'VIP Level 10 name color', coin_cost: 10000, vip_level_required: 10, hex_code: '#8A2BE2', is_gradient: false, display_order: 23 },
      { item_id: 'color_godly', item_type: 'name_color', item_name: 'Godly Name', description: 'VIP Level 15 name color', coin_cost: 50000, vip_level_required: 15, hex_code: '#FF1493', is_gradient: true, gradient_colors: ['#FF1493', '#FFD700'], display_order: 24 },
      // Chat Bubbles
      { item_id: 'bubble_vip6', item_type: 'chat_bubble', item_name: 'Royal Bubble', description: 'VIP Level 6 exclusive bubble', coin_cost: 2000, vip_level_required: 6, is_animated: false, rarity: 'rare', display_order: 30 },
      { item_id: 'bubble_vip11', item_type: 'chat_bubble', item_name: 'Emperor Bubble', description: 'VIP Level 11 exclusive bubble', coin_cost: 15000, vip_level_required: 11, is_animated: true, rarity: 'epic', display_order: 31 },
      { item_id: 'bubble_vip14', item_type: 'chat_bubble', item_name: 'God Bubble', description: 'VIP Level 14 exclusive bubble', coin_cost: 40000, vip_level_required: 14, is_animated: true, rarity: 'legendary', display_order: 32 },
      // Badges
      { item_id: 'badge_vip11', item_type: 'badge', item_name: 'VIP Elite Badge', description: 'VIP Level 11 badge', coin_cost: 0, vip_level_required: 11, display_order: 40 },
      { item_id: 'badge_vip14', item_type: 'badge', item_name: 'Legendary VIP Badge', description: 'VIP Level 14 badge', coin_cost: 0, vip_level_required: 14, display_order: 41 },
      { item_id: 'badge_vip15', item_type: 'badge', item_name: 'Supreme VIP Badge', description: 'VIP Level 15 badge', coin_cost: 0, vip_level_required: 15, display_order: 42 }
    ];
    await CosmeticItem.insertMany(defaults);
    console.log('[VIP SYSTEM] Default cosmetic items initialized:', defaults.length, 'items created');
  } catch (error) {
    console.error('Initialize Default Cosmetics Error:', error);
  }
};