const Family = require('../models/Family');
const FamilyTask = require('../models/FamilyTask');
const User = require('../models/User');
const FamilyPK = require('../models/FamilyPK');
const FamilyWar = require('../models/FamilyWar');
const FamilyChat = require('../models/FamilyChat');
const FamilyShopItem = require('../models/FamilyShopItem');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

// Get family daily task
exports.getFamilyDailyTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    // Get today's task
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    let task = await FamilyTask.findOne({
      familyId: family.familyId,
      status: { $in: ['pending', 'in_progress'] },
      deadline: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: -1 });

    if (!task) {
      // Generate new daily task based on family level
      task = await generateDailyTask(family);
    }

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error('Get Family Daily Task Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get daily task' });
  }
};

// Update family task progress
exports.updateTaskProgress = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId, progressValue } = req.body;

    const task = await FamilyTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const user = await User.findById(userId);
    if (!user || user.familyId !== task.familyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    task.currentProgress = Math.min(task.targetValue, (task.currentProgress || 0) + progressValue);
    task.status = task.currentProgress >= task.targetValue ? 'completed' : 'in_progress';
    
    if (task.status === 'completed') {
      task.completedAt = new Date();
    }

    await task.save();

    // Update family's currentDailyTask if it's the active one
    const family = await Family.findOne({ familyId: task.familyId });
    if (family && family.currentDailyTask && family.currentDailyTask.taskId?.toString() === taskId) {
      family.currentDailyTask.currentProgress = task.currentProgress;
      family.currentDailyTask.status = task.status;
      
      if (task.status === 'completed') {
        // Grant rewards
        family.family_points = (family.family_points || 0) + (task.rewardFamilyPoints || 0);
        family.total_xp = (family.total_xp || 0) + (task.rewardXP || 0);
        
        // Check level up
        await checkLevelUp(family);
      }
      await family.save();
    }

    return successResponse(res, 'Task progress updated', task);
  } catch (error) {
    console.error('Update Task Progress Error:', error);
    return errorResponse(res, 'Failed to update task progress');
  }
};

// Create family (with level requirement and coins fee)
exports.createFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, family_badge, slogan } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.familyId) {
      return res.status(400).json({ success: false, message: 'You are already in a family' });
    }

    // Level requirement check
    if (user.level < 5) {
      return res.status(400).json({ success: false, message: 'You need to reach level 5 to create a family' });
    }

    // Fee configuration
    const creationFee = 1000;
    if (user.coins < creationFee) {
      return res.status(400).json({ success: false, message: `Insufficient coins. You need ${creationFee} coins to create a family` });
    }

    // Check badge uniqueness
    const existingFamily = await Family.findOne({ family_badge: family_badge.toUpperCase() });
    if (existingFamily) {
      return res.status(400).json({ success: false, message: 'This family badge is already taken' });
    }

    // Generate unique familyId
    const familyId = `FAM${Date.now().toString().slice(-6)}`;

    const newFamily = new Family({
      familyId,
      family_name: name,
      family_badge: family_badge.toUpperCase(),
      family_slogan: slogan || '',
      creator_uid: user.uid,
      current_level: 1,
      total_xp: 0,
      members_list: [user.uid],
      family_points: 0,
      total_wealth: 0,
      memberCount: 1,
      member_limit: getMemberLimit(1),
      unlocked_powers: []
    });

    await newFamily.save();

    // Update user
    user.familyId = familyId;
    user.familyRole = 'Patriarch';
    user.coins -= creationFee;
    await user.save();

    return successResponse(res, 'Family created successfully', newFamily);
  } catch (error) {
    console.error('Create Family Error:', error);
    return errorResponse(res, 'Failed to create family');
  }
};

// Join family
exports.joinFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { familyId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.familyId) {
      return res.status(400).json({ success: false, message: 'You are already in a family' });
    }

    const family = await Family.findOne({ familyId, is_active: true });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found or inactive' });
    }

    if (family.memberCount >= family.member_limit) {
      return res.status(400).json({ success: false, message: 'Family is full' });
    }

    family.members_list.push(user.uid);
    family.memberCount += 1;
    await family.save();

    user.familyId = familyId;
    user.familyRole = 'Member';
    await user.save();

    // Send system message to family chat
    await FamilyChat.create({
      familyId: family.familyId,
      senderUid: 'system',
      senderName: 'System',
      messageType: 'system',
      content: `${user.username} has joined the family!`
    });

    return successResponse(res, 'Joined family successfully', family);
  } catch (error) {
    console.error('Join Family Error:', error);
    return errorResponse(res, 'Failed to join family');
  }
};

// Leave family
exports.leaveFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(400).json({ success: false, message: 'You are not in any family' });
    }

    if (user.familyRole === 'Patriarch') {
      return res.status(400).json({ success: false, message: 'Patriarch cannot leave. Transfer ownership or disband the family instead' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (family) {
      family.members_list = family.members_list.filter(uid => uid !== user.uid);
      family.memberCount = Math.max(0, family.memberCount - 1);
      await family.save();
    }

    user.familyId = null;
    user.familyRole = null;
    await user.save();

    return successResponse(res, 'Left family successfully');
  } catch (error) {
    console.error('Leave Family Error:', error);
    return errorResponse(res, 'Failed to leave family');
  }
};

// Get my family
exports.getMyFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'No family found' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    // Get member details
    const members = await User.find({ familyId: family.familyId })
      .select('username uid avatar level isOnline lastActiveAt')
      .lean();

    return successResponse(res, 'Family fetched', { ...family.toObject(), members });
  } catch (error) {
    console.error('Get My Family Error:', error);
    return errorResponse(res, 'Failed to get family');
  }
};

// Get family info by ID
exports.getFamilyById = async (req, res) => {
  try {
    const { familyId } = req.params;
    const family = await Family.findOne({ familyId, is_active: true });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const memberCount = await User.countDocuments({ familyId: family.familyId, isActive: true });
    return successResponse(res, 'Family found', { ...family.toObject(), memberCount });
  } catch (error) {
    console.error('Get Family By ID Error:', error);
    return errorResponse(res, 'Failed to get family');
  }
};

// Get all families with filters
exports.getAllFamilies = async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'total_xp' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const families = await Family.find({ is_active: true })
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return successResponse(res, 'Families fetched', families);
  } catch (error) {
    console.error('Get All Families Error:', error);
    return errorResponse(res, 'Failed to get families');
  }
};

// Get family rankings (Daily, Weekly, Monthly)
exports.getFamilyRankings = async (req, res) => {
  try {
    const { type = 'weekly' } = req.query;
    
    let periodStart;
    const now = new Date();
    
    switch(type) {
      case 'daily':
        periodStart = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'weekly':
        periodStart = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        periodStart = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        periodStart = new Date(now.setDate(now.getDate() - 7));
    }

    const rankings = await Family.find({ is_active: true })
      .sort({ totalGiftingPoints: -1, total_xp: -1 })
      .limit(100)
      .lean();

    const rankedFamilies = rankings.map((family, index) => ({
      rank: index + 1,
      familyId: family.familyId,
      family_name: family.family_name,
      family_badge: family.family_badge,
      current_level: family.current_level,
      total_xp: family.total_xp,
      totalGiftingPoints: family.totalGiftingPoints || 0,
      memberCount: family.memberCount,
      isTopFamily: index < 3
    }));

    return successResponse(res, 'Rankings fetched', { type, rankings: rankedFamilies });
  } catch (error) {
    console.error('Get Family Rankings Error:', error);
    return errorResponse(res, 'Failed to get rankings');
  }
};

// Update family info
exports.updateFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { familyId, name, slogan } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    // Only Patriarch can update
    if (user.familyRole !== 'Patriarch') {
      return res.status(403).json({ success: false, message: 'Only Patriarch can update family details' });
    }

    if (name) family.family_name = name;
    if (slogan !== undefined) family.family_slogan = slogan;
    await family.save();

    return successResponse(res, 'Family updated', family);
  } catch (error) {
    console.error('Update Family Error:', error);
    return errorResponse(res, 'Failed to update family');
  }
};

// Disband family
exports.disbandFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { familyId } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family' });
    }

    if (user.familyRole !== 'Patriarch') {
      return res.status(403).json({ success: false, message: 'Only Patriarch can disband the family' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    // Remove all members
    await User.updateMany({ familyId }, { $unset: { familyId: '', familyRole: '' } });

    await Family.findByIdAndDelete(family._id);

    return successResponse(res, 'Family disbanded successfully');
  } catch (error) {
    console.error('Disband Family Error:', error);
    return errorResponse(res, 'Failed to disband family');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY SHOP
// ─────────────────────────────────────────────────────────────────────────────

// Get shop items
exports.getShopItems = async (req, res) => {
  try {
    const { category, rarity, minLevel, page = 1, limit = 20 } = req.query;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = { isActive: true, unlockLevel: { $lte: family.current_level } };

    if (category && category !== 'all') {
      query.itemType = category;
    }
    if (rarity && rarity !== 'all') {
      query.rarity = rarity;
    }
    if (minLevel) {
      query.unlockLevel = { $lte: parseInt(minLevel) };
    }

    const items = await FamilyShopItem.find(query)
      .sort({ rarity: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return successResponse(res, 'Shop items fetched', {
      items,
      familyPoints: family.family_points,
      currentLevel: family.current_level
    });
  } catch (error) {
    console.error('Get Shop Items Error:', error);
    return errorResponse(res, 'Failed to get shop items');
  }
};

// Purchase shop item
exports.purchaseShopItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const item = await FamilyShopItem.findOne({ itemId, isActive: true });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Check level requirement
    if (family.current_level < item.unlockLevel) {
      return res.status(400).json({ success: false, message: 'Family level too low for this item' });
    }

    // Check limited stock
    if (item.isLimited && item.limitedStock > 0 && item.soldCount >= item.limitedStock) {
      return res.status(400).json({ success: false, message: 'Item out of stock' });
    }

    // Check family points
    if ((family.family_points || 0) < item.priceFamilyPoints) {
      return res.status(400).json({ success: false, message: 'Insufficient family points' });
    }

    // Check coins
    if ((user.coins || 0) < item.priceCoins) {
      return res.status(400).json({ success: false, message: 'Insufficient coins' });
    }

    // Check if already purchased
    const ownedItem = family.family_inventory.find(i => i.itemId === itemId);
    if (ownedItem) {
      return res.status(400).json({ success: false, message: 'Item already owned' });
    }

    // Deduct family points
    family.family_points -= item.priceFamilyPoints;
    user.coins -= item.priceCoins;

    // Add to family inventory
    family.family_inventory.push({
      itemId: item.itemId,
      itemType: item.itemType,
      acquiredAt: new Date()
    });

    // Update item sold count
    item.soldCount += 1;
    await item.save();

    await family.save();
    await user.save();

    return successResponse(res, 'Item purchased successfully', {
      item,
      newBalance: family.family_points
    });
  } catch (error) {
    console.error('Purchase Item Error:', error);
    return errorResponse(res, 'Failed to purchase item');
  }
};

// Get family inventory
exports.getFamilyInventory = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family' });
    }

    const family = await Family.findOne({ familyId: user.familyId }).select('family_inventory family_points');
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    return successResponse(res, 'Inventory fetched', family.family_inventory || []);
  } catch (error) {
    console.error('Get Inventory Error:', error);
    return errorResponse(res, 'Failed to get inventory');
  }
};

// Grant family XP
exports.grantFamilyXP = async (req, res) => {
  try {
    const { familyId, xpAmount, source } = req.body;
    
    const family = await Family.findOne({ familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    family.total_xp += xpAmount;
    await checkLevelUp(family);
    await family.save();

    return successResponse(res, 'XP granted', { 
      total_xp: family.total_xp, 
      current_level: family.current_level 
    });
  } catch (error) {
    console.error('Grant Family XP Error:', error);
    return errorResponse(res, 'Failed to grant XP');
  }
};

// Helper functions
async function generateDailyTask(family) {
  const taskTypes = ['daily_gifting', 'active_hours', 'member_activity'];
  const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
  const level = family.current_level;

  let task;
  switch(taskType) {
    case 'daily_gifting':
      task = {
        title: 'Daily Gifting Spree',
        description: `Gift coins worth ${1000 * level} to family members`,
        targetValue: 1000 * level,
        rewardCoins: 500 * level,
        rewardFamilyPoints: 100 * level,
        rewardXP: 50 * level
      };
      break;
    case 'active_hours':
      task = {
        title: 'Stay Active Together',
        description: `Family members spend ${5 * level} hours in the app`,
        targetValue: 5 * level,
        rewardCoins: 300 * level,
        rewardFamilyPoints: 80 * level,
        rewardXP: 40 * level
      };
      break;
    default:
      task = {
        title: 'Member Activity',
        description: `${Math.max(3, level)} members participate today`,
        targetValue: Math.max(3, level),
        rewardCoins: 400 * level,
        rewardFamilyPoints: 90 * level,
        rewardXP: 45 * level
      };
  }

  const deadline = new Date();
  deadline.setHours(23, 59, 59, 999);

  const newTask = new FamilyTask({
    familyId: family.familyId,
    taskType,
    ...task,
    deadline
  });

  await newTask.save();
  return newTask;
}

async function checkLevelUp(family) {
  const currentLevel = family.current_level;
  const xp = family.total_xp;
  
  const requiredXP = getRequiredXP(currentLevel);
  
  while (xp >= requiredXP && family.current_level < 50) {
    family.current_level += 1;
    family.member_limit = getMemberLimit(family.current_level);
    
    // Unlock special powers based on level
    const newPowers = getUnlockedPowers(family.current_level);
    family.unlocked_powers = [...(family.unlocked_powers || []), ...newPowers];
  }
  
  await family.save();
}

function getMemberLimit(level) {
  return 20 + (level - 1) * 10;
}

function getRequiredXP(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function getUnlockedPowers(level) {
  const powers = [];
  if (level >= 3) powers.push('custom_badge_color');
  if (level >= 5) powers.push('family_announcement');
  if (level >= 7) powers.push('shop_discount_10');
  if (level >= 10) powers.push('vip_badge');
  if (level >= 15) powers.push('war_bonus');
  if (level >= 20) powers.push('custom_emblem');
  return powers;
}

module.exports = {
  successResponse,
  errorResponse
};