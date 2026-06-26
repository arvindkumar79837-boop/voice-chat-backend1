const PowerMatrix = require('../models/PowerMatrix');
const User = require('../models/User');
const Room = require('../models/Room');

function setupPowerMatrixSocketHandlers(io, socket) {
  socket.on('power:check_authority', async (data) => {
    try {
      const { targetUserId, action, roomId } = data;
      const actorId = socket.userId;

      if (!targetUserId || !action) {
        return socket.emit('power:error', { message: 'targetUserId and action are required.' });
      }

      if (!['mute', 'kick'].includes(action)) {
        return socket.emit('power:error', { message: 'Action must be either "mute" or "kick".' });
      }

      const [actor, target, powerMatrix, room] = await Promise.all([
        User.findById(actorId).select('level role isVip vipLevel').lean(),
        User.findById(targetUserId).select('level role isVip vipLevel').lean(),
        PowerMatrix.findOne({ isActive: true }).lean(),
        roomId ? Room.findOne({ roomId }).select('ownerId admins coHosts').lean() : Promise.resolve(null)
      ]);

      if (!actor || !target) {
        return socket.emit('power:error', { message: 'User not found.' });
      }

      if (!powerMatrix) {
        return socket.emit('power:error', { message: 'Power matrix not configured.' });
      }

      const isRoomOwner = room && room.ownerId.toString() === actorId.toString();
      const isRoomAdmin = room && (room.admins.includes(actorId) || room.coHosts.includes(actorId));
      const isTargetOwner = room && room.ownerId.toString() === targetUserId.toString();

      if (isTargetOwner) {
        return socket.emit('power:authorization_result', {
          allowed: false,
          reason: 'Cannot perform action on room owner.',
          powerDetails: {
            actorLevel: actor.level,
            targetLevel: target.level,
            actorRole: actor.role,
            targetRole: target.isVip ? (target.vipLevel >= 10 ? 'svip' : 'vip') : 'user',
            action
          }
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

      socket.emit('power:authorization_result', {
        allowed: result.allowed,
        reason: result.reason,
        powerDetails: {
          actorLevel: actor.level,
          targetLevel: target.level,
          actorRole,
          targetRole,
          action
        }
      });
    } catch (error) {
      console.error('Power check socket error:', error);
      socket.emit('power:error', { message: 'Failed to check authority.' });
    }
  });

  socket.on('room:mute_user', async (data) => {
    try {
      const { roomId, targetUserId } = data;

      const powerResult = await validateSocketPower(io, socket, socket.userId, targetUserId, 'mute', roomId);
      if (!powerResult.allowed) {
        return socket.emit('room:error', {
          message: powerResult.reason,
          powerDetails: powerResult.powerDetails
        });
      }

      const room = await Room.findOne({ roomId });
      if (!room) {
        return socket.emit('room:error', { message: 'Room not found.' });
      }

      const seatIndex = room.seats.findIndex(seat => seat.userId.toString() === targetUserId.toString());
      if (seatIndex === -1) {
        return socket.emit('room:error', { message: 'User not in room.' });
      }

      room.seats[seatIndex].isMuted = true;
      await room.save();

      io.to(roomId).emit('room:user_muted', {
        userId: targetUserId,
        seatIndex,
        mutedBy: socket.userId,
        timestamp: new Date()
      });

      const actionLog = {
        action: 'mute',
        actorId: socket.userId,
        targetUserId,
        roomId,
        allowed: true,
        timestamp: new Date()
      };
      await storePowerActionLog(actionLog);
    } catch (error) {
      console.error('Mute user socket error:', error);
      socket.emit('room:error', { message: 'Failed to mute user.' });
    }
  });

  socket.on('room:kick_user', async (data) => {
    try {
      const { roomId, targetUserId } = data;

      const powerResult = await validateSocketPower(io, socket, socket.userId, targetUserId, 'kick', roomId);
      if (!powerResult.allowed) {
        return socket.emit('room:error', {
          message: powerResult.reason,
          powerDetails: powerResult.powerDetails
        });
      }

      const room = await Room.findOne({ roomId });
      if (!room) {
        return socket.emit('room:error', { message: 'Room not found.' });
      }

      const seatIndex = room.seats.findIndex(seat => seat.userId.toString() === targetUserId.toString());
      if (seatIndex === -1) {
        return socket.emit('room:error', { message: 'User not in room.' });
      }

      const removedUser = room.seats[seatIndex];
      room.seats[seatIndex] = {
        seatIndex,
        userId: null,
        userName: '',
        userAvatar: '',
        isMuted: false,
        isLocked: false,
        isHost: false,
        joinedAt: null
      };
      room.activeUsers = Math.max(0, room.activeUsers - 1);
      await room.save();

      io.to(targetUserId).emit('room:kicked', {
        roomId,
        reason: 'You have been removed from the room.',
        kickedBy: socket.userId,
        timestamp: new Date()
      });

      io.to(roomId).emit('room:user_kicked', {
        userId: targetUserId,
        seatIndex,
        kickedBy: socket.userId,
        timestamp: new Date()
      });

      socket.to(roomId).emit('room:user_left', {
        userId: targetUserId,
        seatIndex,
        reason: 'kicked'
      });

      const actionLog = {
        action: 'kick',
        actorId: socket.userId,
        targetUserId,
        roomId,
        allowed: true,
        timestamp: new Date()
      };
      await storePowerActionLog(actionLog);
    } catch (error) {
      console.error('Kick user socket error:', error);
      socket.emit('room:error', { message: 'Failed to kick user.' });
    }
  });

  socket.on('room:unmute_user', async (data) => {
    try {
      const { roomId, targetUserId } = data;

      const room = await Room.findOne({ roomId });
      if (!room) {
        return socket.emit('room:error', { message: 'Room not found.' });
      }

      const isOwner = room.ownerId.toString() === socket.userId.toString();
      const isAdmin = room.admins.includes(socket.userId) || room.coHosts.includes(socket.userId);

      if (!isOwner && !isAdmin) {
        return socket.emit('room:error', { message: 'Only owner or admin can unmute users.' });
      }

      const seatIndex = room.seats.findIndex(seat => seat.userId.toString() === targetUserId.toString());
      if (seatIndex === -1) {
        return socket.emit('room:error', { message: 'User not in room.' });
      }

      room.seats[seatIndex].isMuted = false;
      await room.save();

      io.to(roomId).emit('room:user_unmuted', {
        userId: targetUserId,
        seatIndex,
        unmutedBy: socket.userId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Unmute user socket error:', error);
      socket.emit('room:error', { message: 'Failed to unmute user.' });
    }
  });

  socket.on('admin:update_power_matrix', async (data) => {
    try {
      const { rules, globalSettings } = data;
      const userId = socket.userId;

      const user = await User.findById(userId).select('role').lean();
      if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
        return socket.emit('admin:error', { message: 'Only admins or owner can update power matrix.' });
      }

      const currentMatrix = await PowerMatrix.findOne({ isActive: true });
      if (!currentMatrix) {
        return socket.emit('admin:error', { message: 'Power matrix not found.' });
      }

      const updatedMatrix = await PowerMatrix.findByIdAndUpdate(
        currentMatrix._id,
        {
          rules,
          globalSettings: globalSettings || currentMatrix.globalSettings,
          updatedBy: userId,
          version: currentMatrix.version + 1
        },
        { new: true }
      );

      io.emit('power:matrix_updated', {
        success: true,
        message: 'Power matrix updated successfully',
        data: {
          isActive: updatedMatrix.isActive,
          globalSettings: updatedMatrix.globalSettings,
          version: updatedMatrix.version,
          updatedAt: updatedMatrix.updatedAt
        }
      });
    } catch (error) {
      console.error('Admin update power matrix error:', error);
      socket.emit('admin:error', { message: 'Failed to update power matrix.' });
    }
  });

  socket.on('admin:reset_power_matrix', async (data) => {
    try {
      const userId = socket.userId;

      const user = await User.findById(userId).select('role').lean();
      if (!user || user.role !== 'owner') {
        return socket.emit('admin:error', { message: 'Only owner can reset power matrix.' });
      }

      await PowerMatrix.deleteMany({});

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

      const newMatrix = await PowerMatrix.create({
        isActive: true,
        rules: defaultRules,
        globalSettings: {
          ownerCanOverrideAll: true,
          adminCanOverrideVip: true,
          svipImmunityLevel: 10,
          vipImmunityLevel: 8,
          levelDifferenceRequired: 2
        },
        createdBy: userId,
        version: 1
      });

      io.emit('power:matrix_reset', {
        success: true,
        message: 'Power matrix reset to defaults successfully',
        data: {
          version: newMatrix.version,
          updatedAt: newMatrix.updatedAt
        }
      });
    } catch (error) {
      console.error('Admin reset power matrix error:', error);
      socket.emit('admin:error', { message: 'Failed to reset power matrix.' });
    }
  });
}

async function validateSocketPower(io, socket, actorId, targetUserId, action, roomId) {
  try {
    const [actor, target, powerMatrix, room] = await Promise.all([
      User.findById(actorId).select('level role isVip vipLevel').lean(),
      User.findById(targetUserId).select('level role isVip vipLevel').lean(),
      PowerMatrix.findOne({ isActive: true }).lean(),
      roomId ? Room.findOne({ roomId }).select('ownerId admins coHosts').lean() : Promise.resolve(null)
    ]);

    if (!actor || !target) {
      return { allowed: false, reason: 'User not found.' };
    }

    if (!powerMatrix) {
      return { allowed: false, reason: 'Power matrix not configured.' };
    }

    const isRoomOwner = room && room.ownerId.toString() === actorId.toString();
    const isRoomAdmin = room && (room.admins.includes(actorId) || room.coHosts.includes(actorId));
    const isTargetOwner = room && room.ownerId.toString() === targetUserId.toString();

    if (isTargetOwner) {
      return { allowed: false, reason: 'Cannot perform action on room owner.', powerDetails: { isTargetOwner: true } };
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

    if (!result.allowed) {
      return {
        allowed: false,
        reason: result.reason,
        powerDetails: {
          actorLevel: actor.level,
          targetLevel: target.level,
          actorRole,
          targetRole,
          action
        }
      };
    }

    return {
      allowed: true,
      reason: result.reason,
      powerDetails: {
        actorLevel: actor.level,
        targetLevel: target.level,
        actorRole,
        targetRole,
        action
      }
    };
  } catch (error) {
    console.error('Validate socket power error:', error);
    return { allowed: false, reason: 'Failed to validate power.' };
  }
}

async function storePowerActionLog(actionLog) {
  try {
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      action: `power_${actionLog.action}`,
      actorId: actionLog.actorId,
      targetUserId: actionLog.targetUserId,
      details: {
        roomId: actionLog.roomId,
        allowed: actionLog.allowed,
        timestamp: actionLog.timestamp
      },
      timestamp: actionLog.timestamp
    });
  } catch (error) {
    console.error('Failed to store power action log:', error);
  }
}

module.exports = setupPowerMatrixSocketHandlers;