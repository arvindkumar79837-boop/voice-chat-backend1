const PowerMatrix = require('../models/PowerMatrix');
const User = require('../models/User');
const Room = require('../models/Room');

const getUserId = (req) => {
  return req.user?.id || req.user?.userId || req.user?._id || null;
};

const initializePowerMatrix = async (createdBy) => {
  const existing = await PowerMatrix.findOne({ isActive: true });
  if (existing) return existing;

  const defaultRules = [];
  for (let level = 1; level <= 50; level++) {
    defaultRules.push({
      level,
      canMuteLowerLevels: level >= 3,
      canKickLowerLevels: level >= 5,
      muteLevelThreshold: level >= 10 ? level - 2 : 0,
      kickLevelThreshold: level >= 15 ? level - 3 : 0,
      vipProtectionLevel: 0,
      specialPrivileges: level >= 20 ? [{
        privilege: 'bypass_mute',
        appliesToLevel: level,
        description: `Level ${level} bypass mute protection`
      }] : []
    });
  }

  const matrix = await PowerMatrix.create({
    isActive: true,
    rules: defaultRules,
    globalSettings: {
      ownerCanOverrideAll: true,
      adminCanOverrideVip: true,
      svipImmunityLevel: 10,
      vipImmunityLevel: 8,
      levelDifferenceRequired: 2
    },
    createdBy,
    version: 1
  });

  return matrix;
};

exports.getPowerMatrix = async (req, res) => {
  try {
    let matrix = await PowerMatrix.findOne({ isActive: true })
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .lean();

    if (!matrix) {
      const userId = getUserId(req);
      matrix = await initializePowerMatrix(userId);
      matrix = await PowerMatrix.findById(matrix._id)
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username email')
        .lean();
    }

    return res.status(200).json({
      success: true,
      message: 'Power matrix fetched successfully',
      data: matrix
    });
  } catch (error) {
    console.error('Get Power Matrix Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch power matrix.',
      error: error.message
    });
  }
};

exports.updatePowerMatrix = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { rules, globalSettings } = req.body;

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rules array is required and cannot be empty.'
      });
    }

    const currentMatrix = await PowerMatrix.findOne({ isActive: true });
    if (!currentMatrix) {
      return res.status(404).json({
        success: false,
        message: 'Power matrix not found. Please initialize first.'
      });
    }

    const updatedMatrix = await PowerMatrix.findByIdAndUpdate(
      currentMatrix._id,
      {
        rules,
        globalSettings: globalSettings || currentMatrix.globalSettings,
        updatedBy: userId,
        version: currentMatrix.version + 1
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username email')
     .populate('updatedBy', 'username email');

    return res.status(200).json({
      success: true,
      message: 'Power matrix updated successfully',
      data: updatedMatrix
    });
  } catch (error) {
    console.error('Update Power Matrix Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update power matrix.',
      error: error.message
    });
  }
};

exports.resetPowerMatrix = async (req, res) => {
  try {
    const userId = getUserId(req);

    await PowerMatrix.deleteMany({});

    const newMatrix = await initializePowerMatrix(userId);
    const populatedMatrix = await PowerMatrix.findById(newMatrix._id)
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Power matrix reset to defaults successfully',
      data: populatedMatrix
    });
  } catch (error) {
    console.error('Reset Power Matrix Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset power matrix.',
      error: error.message
    });
  }
};

exports.checkUserPower = async (req, res) => {
  try {
    const { targetUserId, action } = req.body;
    const actorId = getUserId(req);

    if (!targetUserId || !action) {
      return res.status(400).json({
        success: false,
        message: 'targetUserId and action are required.'
      });
    }

    if (!['mute', 'kick'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "mute" or "kick".'
      });
    }

    const [actor, target, powerMatrix, room] = await Promise.all([
      User.findById(actorId).select('level role isVip vipLevel').lean(),
      User.findById(targetUserId).select('level role isVip vipLevel').lean(),
      PowerMatrix.findOne({ isActive: true }).lean(),
      Room.findOne({ 'seats.userId': targetUserId }).select('ownerId admins coHosts').lean()
    ]);

    if (!actor || !target) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!powerMatrix) {
      return res.status(500).json({
        success: false,
        message: 'Power matrix not configured.'
      });
    }

    const isRoomOwner = room && room.ownerId.toString() === actorId.toString();
    const isRoomAdmin = room && (room.admins.includes(actorId) || room.coHosts.includes(actorId));
    const isTargetOwner = room && room.ownerId.toString() === targetUserId.toString();

    if (isTargetOwner) {
      return res.status(403).json({
        success: false,
        message: 'Cannot perform action on room owner.',
        allowed: false,
        reason: 'Target is room owner'
      });
    }

    let actorRole = actor.role;
    if (isRoomOwner) actorRole = 'owner';
    else if (isRoomAdmin) actorRole = 'admin';

    const targetRole = target.isVip ? (target.vipLevel >= 10 ? 'svip' : 'vip') : 'user';

    let result;
    if (action === 'mute') {
      result = powerMatrix.canUserMute(actor.level, target.level, actorRole, targetRole);
    } else {
      result = powerMatrix.canUserKick(actor.level, target.level, actorRole, targetRole);
    }

    return res.status(200).json({
      success: true,
      message: 'Power check completed',
      data: {
        allowed: result.allowed,
        reason: result.reason,
        actorLevel: actor.level,
        targetLevel: target.level,
        actorRole,
        targetRole,
        action
      }
    });
  } catch (error) {
    console.error('Check User Power Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check user power.',
      error: error.message
    });
  }
};

exports.getPowerMatrixHistory = async (req, res) => {
  try {
    const history = await PowerMatrix.find()
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Power matrix history fetched successfully',
      data: history
    });
  } catch (error) {
    console.error('Get Power Matrix History Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch power matrix history.',
      error: error.message
    });
  }
};