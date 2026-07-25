const Logger = require('../utils/logger');
const User = require('../models/User');
const Room = require('../models/Room');
const crypto = require('crypto');
const { getRedisClient } = require('../config/redis');

const MATCHMAKING_QUEUE_KEY = 'blind_date:matchmaking_queue';

const attemptToMatchUsers = async (io) => {
  const redis = getRedisClient();
  if (!redis) {
    Logger.warn('[Matchmaking] Redis not available');
    return;
  }

  try {
    const queueSize = await redis.lLen(MATCHMAKING_QUEUE_KEY);
    if (queueSize < 2) return;

    const user1Raw = await redis.lPop(MATCHMAKING_QUEUE_KEY);
    const user2Raw = await redis.lPop(MATCHMAKING_QUEUE_KEY);
    
    if (!user1Raw || !user2Raw) {
      if (user1Raw) await redis.lPush(MATCHMAKING_QUEUE_KEY, user1Raw);
      return;
    }

    const user1 = JSON.parse(user1Raw);
    const user2 = JSON.parse(user2Raw);

    Logger.info(`[Matchmaking] Attempting to match ${user1.name} with ${user2.name}`);

    const newRoom = new Room({
      roomId: `ROOM_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      title: `Blind Date: ${user1.name} & ${user2.name}`,
      roomType: 'PRIVATE',
      roomCategory: 'blind_date',
      ownerId: user1.userId,
      isTemporary: true,
      maxUsers: 2,
    });
    await newRoom.save();

    const payloadForUser1 = {
      match: { userId: user2.userId, name: user2.name, avatar: user2.avatar, age: user2.age, gender: user2.gender },
      roomId: newRoom._id.toString(),
    };
    const payloadForUser2 = {
      match: { userId: user1.userId, name: user1.name, avatar: user1.avatar, age: user1.age, gender: user1.gender },
      roomId: newRoom._id.toString(),
    };

    io.to(user1.socketId).emit('blind_date:match_found', payloadForUser1);
    io.to(user2.socketId).emit('blind_date:match_found', payloadForUser2);

    Logger.info(`[Matchmaking] Match found! Room ${newRoom._id} created.`);
  } catch (error) {
    Logger.error('[Matchmaking] Error in attemptToMatchUsers:', error);
  }
};

let matchmakingInterval;

const startMatchmaking = (io) => {
  if (matchmakingInterval) return;
  matchmakingInterval = setInterval(() => {
    attemptToMatchUsers(io);
  }, 5000);
};

module.exports = (io, socket) => {
  startMatchmaking(io);
  
  socket.on('blind_date:start_search', async () => {
    const redis = getRedisClient();
    if (!redis) return socket.emit('blind_date:error', { message: 'Matchmaking unavailable' });

    try {
      const user = await User.findById(socket.data.userId).lean();
      if (!user) return;
      
      const queueEntry = {
        socketId: socket.id,
        userId: user._id.toString(),
        name: user.name || user.username,
        avatar: user.avatar,
        age: user.age,
        gender: user.gender,
      };

      const currentQueue = await redis.lRange(MATCHMAKING_QUEUE_KEY, 0, -1);
      for (const item of currentQueue) {
        const parsed = JSON.parse(item);
        if (parsed.socketId === socket.id || parsed.userId === user._id.toString()) {
          await redis.lRem(MATCHMAKING_QUEUE_KEY, 0, item);
        }
      }

      await redis.rPush(MATCHMAKING_QUEUE_KEY, JSON.stringify(queueEntry));
      Logger.info(`[Matchmaking] ${queueEntry.name} joined queue.`);
      attemptToMatchUsers(io);
    } catch (error) {
      Logger.error('[Matchmaking] Error adding user to queue:', error);
    }
  });

  socket.on('blind_date:cancel_search', async () => {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      const currentQueue = await redis.lRange(MATCHMAKING_QUEUE_KEY, 0, -1);
      for (const item of currentQueue) {
        const parsed = JSON.parse(item);
        if (parsed.socketId === socket.id) {
          await redis.lRem(MATCHMAKING_QUEUE_KEY, 0, item);
          Logger.info(`[Matchmaking] ${parsed.name} left queue.`);
          break;
        }
      }
    } catch (error) {
      Logger.error('[Matchmaking] Error cancelling search:', error);
    }
  });

  socket.on('disconnect', async () => {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      const currentQueue = await redis.lRange(MATCHMAKING_QUEUE_KEY, 0, -1);
      for (const item of currentQueue) {
        const parsed = JSON.parse(item);
        if (parsed.socketId === socket.id) {
          await redis.lRem(MATCHMAKING_QUEUE_KEY, 0, item);
          Logger.info(`[Matchmaking] ${parsed.name} disconnected, removed from queue.`);
          break;
        }
      }
    } catch (error) {
      Logger.error('[Matchmaking] Error removing user on disconnect:', error);
    }
  });
};