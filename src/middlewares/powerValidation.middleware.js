const PowerMatrix = require('../models/PowerMatrix');
const User = require('../models/User');
const Room = require('../models/Room');

const checkPowerMiddleware = async (req, res, next) => {
  try {
    const actorId = req.user?.id || req.user?.userId || req.user?._id;
    const targetUserId = req.body.targetUserId || req.params.userId;
    const action = req.body.action;

    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required.'
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
      if (!result.allowed) {
        return res.status(403).json({
          success: false,
          message: result.reason,
          allowed: false,
          reason: result.reason,
          powerDetails: {
            actorLevel: actor.level,
            targetLevel: target.level,
            actorRole,
            targetRole,
            action
          }
        });
      }
    } else if (action === 'kick') {
      result = powerMatrix.canUserKick(actor.level, target.level, actorRole, targetRole);
      if (!result.allowed) {
        return res.status(403).json({
          success: false,
          message: result.reason,
          allowed: false,
          reason: result.reason,
          powerDetails: {
            actorLevel: actor.level,
            targetLevel: target.level,
            actorRole,
            targetRole,
            action
          }
        });
      }
    }

    req.powerValidation = {
      allowed: true,
      actorLevel: actor.level,
      targetLevel: target.level,
      actorRole,
      targetRole,
      action,
      reason: result.reason
    };

    next();
  } catch (error) {
    console.error('Power validation middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate power.',
      error: error.message
    });
  }
};

const checkRoomOwner = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const roomId = req.body.roomId || req.params.roomId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required.'
      });
    }

    const room = await Room.findOne({ roomId }).select('ownerId admins coHosts').lean();
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.'
      });
    }

    const isOwner = room.ownerId.toString() === userId.toString();
    const isAdmin = room.admins.includes(userId) || room.coHosts.includes(userId);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only room owner or admin can perform this action.'
      });
    }

    req.roomContext = {
      roomId,
      isOwner,
      isAdmin,
      room
    };

    next();
  } catch (error) {
    console.error('Room owner check middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify room ownership.',
      error: error.message
    });
  }
};

module.exports = {
  checkPowerMiddleware,
  checkRoomOwner
};