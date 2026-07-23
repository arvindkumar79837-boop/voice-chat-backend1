const Logger = require('../utils/logger');
const Family = require('../models/Family');
const User = require('../models/User');
const FamilyStayReward = require('../models/FamilyStayReward');
const { getRedisClient } = require('../config/redis');

const getRedis = () => {
  const client = getRedisClient();
  if (!client || !client.isOpen) throw new Error('Redis not available');
  return client;
};
const chatHistoryKey = (familyId) => `family:chat:${familyId}`;
const onlineFamilyKey = (familyId) => `family:online:${familyId}`;
const staySessionKey = (uid) => `family:stay:${uid}`;

// ──────────────────────────────────────────────
// Socket.io Family Chat + Stay Reward Middleware
// ──────────────────────────────────────────────
function setupFamilySocketHandlers(io, socket) {
  const uid = socket.data?.userId;

  if (!uid) {
    return socket.emit('error', { message: 'Unauthenticated' });
  }

  socket.on('family:join', async (familyId) => {
    try {
      const user = await User.findOne({ _id: uid, familyId, isBanned: false });
      if (!user) {
        return socket.emit('family:error', { message: 'You are not a member of this family.' });
      }

      const family = await Family.findOne({ familyId, is_active: true, is_banned: false });
      if (!family) {
        return socket.emit('family:error', { message: 'Family not found or inactive.' });
      }

      socket.join(`family:${familyId}`);
      socket.data.familyId = familyId;

      await getRedis().sAdd(onlineFamilyKey(familyId), uid);
      await getRedis().sAdd('families:all', familyId);

      const onlineCount = await getRedis().sCard(onlineFamilyKey(familyId));
      io.to(`family:${familyId}`).emit('family:online_count', { familyId, count: onlineCount });

      socket.emit('family:joined', { familyId, family_name: family.family_name });
    } catch (error) {
      Logger.error('Family Join Error:', error);
      socket.emit('family:error', { message: 'Failed to join family room.' });
    }
  });

  socket.on('family:leave', async (familyId) => {
    try {
      socket.leave(`family:${familyId}`);
      await getRedis().sRem(onlineFamilyKey(familyId), uid);

      const onlineCount = await getRedis().sCard(onlineFamilyKey(familyId));
      io.to(`family:${familyId}`).emit('family:online_count', { familyId, count: onlineCount });

      socket.data.familyId = null;
    } catch (error) {
      Logger.error('Family Leave Error:', error);
    }
  });

  socket.on('family:send_message', async (payload) => {
    try {
      const { familyId, message, type = 'text' } = payload;
      const user = await User.findById(uid).lean();

      if (!user || !user.familyId || user.familyId !== familyId) {
        return socket.emit('family:error', { message: 'Not authorized.' });
      }

      const family = await Family.findOne({ familyId }).lean();
      if (!family) {
        return socket.emit('family:error', { message: 'Family not found.' });
      }

      const chatMessage = {
        uid: user.uid,
        username: user.username,
        avatar: user.avatar,
        message,
        type,
        timestamp: new Date(),
        messageId: `${Date.now()}_${user.uid}`,
      };

      await getRedis().lPush(chatHistoryKey(familyId), JSON.stringify(chatMessage));
      await getRedis().lTrim(chatHistoryKey(familyId), 0, 99);
      await getRedis().publish('family:chat', JSON.stringify({ familyId, message: chatMessage }));

      io.to(`family:${familyId}`).emit('family:new_message', chatMessage);
    } catch (error) {
      Logger.error('Family Send Message Error:', error);
      socket.emit('family:error', { message: 'Failed to send message.' });
    }
  });

  socket.on('family:send_gift_alert', async (payload) => {
    try {
      const { familyId, giftId, giftName, giftValue, receiverUid } = payload;

      const user = await User.findById(uid).lean();
      if (!user || !user.familyId || user.familyId !== familyId) {
        return socket.emit('family:error', { message: 'Not authorized.' });
      }

      const alert = {
        type: 'gift_alert',
        senderUid: user.uid,
        senderName: user.username,
        giftId,
        giftName,
        giftValue,
        receiverUid,
        timestamp: new Date(),
      };

      io.to(`family:${familyId}`).emit('family:gift_alert', alert);
    } catch (error) {
      Logger.error('Family Gift Alert Error:', error);
    }
  });

  // ─── STAY REWARD SOCKET EVENTS ───────────────────────────────────────

  socket.on('family:stay:start', async (payload) => {
    try {
      const { familyId, roomId, seatIndex } = payload;

      const user = await User.findOne({ _id: uid, familyId, isBanned: false });
      if (!user) {
        return socket.emit('family:stay:error', { message: 'Not a family member.' });
      }

      const family = await Family.findOne({ familyId });
      if (!family) {
        return socket.emit('family:stay:error', { message: 'Family not found.' });
      }

      const existingSession = await FamilyStayReward.findOne({
        uid: user.uid,
        familyId: familyId,
        isActive: true
      });

      if (existingSession) {
        return socket.emit('family:stay:error', { message: 'Stay session already active.' });
      }

      const session = new FamilyStayReward({
        familyId: familyId,
        uid: user.uid,
        roomId: roomId || family.official_room_id || '',
        seatIndex: seatIndex || 0,
        sessionStart: new Date(),
        rewardInterval: 5,
        lastRewardAt: new Date(),
        isActive: true
      });

      await session.save();
        await getRedis().set(staySessionKey(uid), session._id.toString(), { EX: 86400 });

      io.to(`family:${familyId}`).emit('family:stay:started', {
        uid: user.uid,
        username: user.username,
        roomId: session.roomId,
        seatIndex: session.seatIndex,
        startedAt: session.sessionStart
      });

      socket.emit('family:stay:session', { sessionId: session._id, active: true });
    } catch (error) {
      Logger.error('Family Stay Start Error:', error);
      socket.emit('family:stay:error', { message: 'Failed to start stay session.' });
    }
  });

  socket.on('family:stay:redeem', async (payload) => {
    try {
      const { familyId } = payload;

      const family = await Family.findOne({ familyId });
      if (!family) {
        return socket.emit('family:stay:error', { message: 'Family not found.' });
      }

      const session = await FamilyStayReward.findOne({
        uid: uid,
        familyId: familyId,
        isActive: true
      });

      if (!session) {
        return socket.emit('family:stay:error', { message: 'No active stay session.' });
      }

      const now = new Date();
      const elapsedMinutes = (now.getTime() - session.lastRewardAt.getTime()) / 60000;

      if (elapsedMinutes < session.rewardInterval) {
        const remainingMs = (session.rewardInterval - elapsedMinutes) * 60000;
        socket.emit('family:stay:cooldown', {
          remainingMs: Math.round(remainingMs),
          canRedeem: false
        });
        return;
      }

      const intervalsEarned = Math.floor(elapsedMinutes / session.rewardInterval);
      const coinsPerInterval = family.reward_config.stay_reward_coins_per_5min || 10;
      const xpPerInterval = family.reward_config.stay_reward_xp_per_5min || 5;

      const coinsEarned = coinsPerInterval * intervalsEarned;
      const xpEarned = xpPerInterval * intervalsEarned;

      const updatedSession = await FamilyStayReward.findOneAndUpdate(
        { _id: session._id, isActive: true },
        {
          $inc: { coinsEarned: coinsEarned, xpEarned: xpEarned, durationMinutes: session.rewardInterval * intervalsEarned },
          $set: { lastRewardAt: now }
        },
        { new: true }
      );

      const updatedUser = await User.findOneAndUpdate(
        { _id: uid },
        { $inc: { coins: coinsEarned, xp: xpEarned, familyContribution: coinsEarned } },
        { new: true }
      );

      await Family.findOneAndUpdate(
        { familyId: family.familyId },
        { $inc: { total_xp: xpEarned, totalWealth: coinsEarned } }
      );

      socket.emit('family:stay:reward', {
        coinsEarned,
        xpEarned,
        totalDurationMinutes: updatedSession?.durationMinutes || 0,
        totalCoinsEarned: updatedSession?.coinsEarned || 0,
        totalXpEarned: updatedSession?.xpEarned || 0,
        canRedeem: false,
        nextRewardAt: new Date(now.getTime() + session.rewardInterval * 60000)
      });

      io.to(`family:${familyId}`).emit('family:stay:rewarded', {
        uid: uid,
        username: user?.username || 'Unknown',
        coinsEarned,
        xpEarned
      });
    } catch (error) {
      Logger.error('Family Stay Redeem Error:', error);
      socket.emit('family:stay:error', { message: 'Failed to redeem reward.' });
    }
  });

  socket.on('family:stay:end', async (payload) => {
    try {
      const { familyId } = payload;

      const session = await FamilyStayReward.findOne({
        uid: uid,
        familyId: familyId,
        isActive: true
      });

      if (session) {
        session.isActive = false;
        session.sessionEnd = new Date();
        const totalMinutes = (session.sessionEnd.getTime() - session.sessionStart.getTime()) / 60000;
        session.durationMinutes = Math.round(totalMinutes);
        await session.save();
        await getRedis().del(staySessionKey(uid));
      }

      socket.emit('family:stay:ended', {
        durationMinutes: session?.durationMinutes || 0,
        totalCoinsEarned: session?.coinsEarned || 0,
        totalXpEarned: session?.xpEarned || 0
      });

      if (familyId) {
        io.to(`family:${familyId}`).emit('family:stay:left', { uid });
      }
    } catch (error) {
      Logger.error('Family Stay End Error:', error);
    }
  });

  socket.on('family:stay:status', async (payload) => {
    try {
      const { familyId } = payload;
      const session = await FamilyStayReward.findOne({
        uid: uid,
        familyId: familyId,
        isActive: true
      }).lean();

      if (session) {
        const elapsedMinutes = (Date.now() - new Date(session.lastRewardAt).getTime()) / 60000;
        const canRedeem = elapsedMinutes >= session.rewardInterval;
        const remainingMs = canRedeem ? 0 : Math.round((session.rewardInterval - elapsedMinutes) * 60000);

        socket.emit('family:stay:status', {
          active: true,
          sessionId: session._id,
          durationMinutes: session.durationMinutes,
          totalCoinsEarned: session.coinsEarned,
          totalXpEarned: session.xpEarned,
          canRedeem,
          remainingMs,
          nextRewardAt: new Date(new Date(session.lastRewardAt).getTime() + session.rewardInterval * 60000)
        });
      } else {
        socket.emit('family:stay:status', { active: false });
      }
    } catch (error) {
      Logger.error('Family Stay Status Error:', error);
      socket.emit('family:stay:status', { active: false });
    }
  });

  socket.on('family:disconnect', async () => {
    try {
      const familyId = socket.data?.familyId;
      if (familyId) {
        await getRedis().sRem(onlineFamilyKey(familyId), uid);
        const onlineCount = await getRedis().sCard(onlineFamilyKey(familyId));
        io.to(`family:${familyId}`).emit('family:online_count', { familyId, count: onlineCount });
      }

      const session = await FamilyStayReward.findOne({
        uid: uid,
        isActive: true
      });

      if (session) {
        session.isActive = false;
        session.sessionEnd = new Date();
        await session.save();
        await getRedis().del(staySessionKey(uid));
      }
    } catch (error) {
      Logger.error('Family Disconnect Error:', error);
    }
  });
}

exports.setupFamilySocketHandlers = setupFamilySocketHandlers;