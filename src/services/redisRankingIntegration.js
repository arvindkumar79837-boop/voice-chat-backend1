/**
 * Arvind Party - Redis Ranking Integration Service
 * Call this from controllers to automatically update rankings when events happen
 */

const redisRankingService = require('./redisRankingService');
const User = require('../models/User');
const Family = require('../models/Family');
const Agency = require('../models/Agency');
const Room = require('../models/Room');
const Gift = require('../models/Gift');

class RedisRankingIntegration {
  // ─── GIFT SYSTEM INTEGRATION ─────────────────────────────────────────────
  async onGiftSent(senderId, receiverId, giftId, giftValue, giftName = '', giftIcon = '') {
    try {
      const sender = await User.findById(senderId).select('uid name avatar country');
      const receiver = await User.findById(receiverId).select('uid name avatar country');

      if (sender) {
        await redisRankingService.addWealthScore(
          sender.uid,
          giftValue,
          sender.country || 'global',
          sender.name || sender.username,
          sender.avatar || ''
        );
      }

      if (receiver) {
        await redisRankingService.addCharmScore(
          receiver.uid,
          giftValue,
          receiver.country || 'global',
          receiver.name || receiver.username,
          receiver.avatar || ''
        );
      }

      await redisRankingService.addGiftUsage(
        giftId,
        senderId,
        1,
        sender?.country || 'global',
        giftName,
        giftIcon
      );
    } catch (error) {
      console.error('Gift Ranking Integration Error:', error.message);
    }
  }

  // ─── FAMILY SYSTEM INTEGRATION ──────────────────────────────────────────
  async onFamilyActivity(familyId, points, userId) {
    try {
      const family = await Family.findById(familyId).select('name icon country members');
      if (family && family.country) {
        await redisRankingService.addFamilyScore(
          familyId,
          points,
          family.country,
          family.name,
          family.icon || ''
        );
      }

      if (family && family.members && family.members.length > 0) {
        for (const memberId of family.members) {
          const user = await User.findById(memberId).select('uid name avatar country');
          if (user) {
            await redisRankingService.addCharmScore(
              user.uid,
              points,
              user.country || 'global',
              user.name || user.username,
              user.avatar || ''
            );
          }
        }
      }
    } catch (error) {
      console.error('Family Ranking Integration Error:', error.message);
    }
  }

  // ─── AGENCY SYSTEM INTEGRATION ──────────────────────────────────────────
  async onAgencyDiamondEarned(agencyId, diamonds) {
    try {
      const agency = await Agency.findById(agencyId).select('name logo country');
      if (agency) {
        await redisRankingService.addAgencyScore(
          agencyId,
          diamonds,
          agency.country || 'global',
          agency.name,
          agency.logo || ''
        );
      }
    } catch (error) {
      console.error('Agency Ranking Integration Error:', error.message);
    }
  }

  // ─── ROOM SYSTEM INTEGRATION ────────────────────────────────────────────
  async onRoomActivity(roomId, trafficScore, hostId) {
    try {
      const room = await Room.findById(roomId).select('name hostId country');
      const host = await User.findById(hostId).select('uid name avatar country');

      if (room) {
        await redisRankingService.addRoomScore(
          roomId,
          trafficScore,
          room.country || 'global',
          room.name,
          host?.name || host?.username || 'Unknown'
        );
      }
    } catch (error) {
      console.error('Room Ranking Integration Error:', error.message);
    }
  }

  // ─── PK BATTLE SYSTEM INTEGRATION ───────────────────────────────────────
  async onPKBattleEnded(hostId, opponentId, winnerId, hostScore, opponentScore) {
    try {
      const host = await User.findById(hostId).select('uid name avatar country');
      const opponent = await User.findById(opponentId).select('uid name avatar country');

      if (winnerId) {
        if (winnerId.toString() === hostId.toString() && host) {
          await redisRankingService.addPKScore(
            host.uid,
            1,
            hostScore,
            host.country || 'global',
            host.name || host.username,
            host.avatar || ''
          );
        } else if (winnerId.toString() === opponentId.toString() && opponent) {
          await redisRankingService.addPKScore(
            opponent.uid,
            1,
            opponentScore,
            opponent.country || 'global',
            opponent.name || opponent.username,
            opponent.avatar || ''
          );
        }
      }

      if (host) {
        await redisRankingService.addPKScore(
          host.uid,
          0,
          hostScore,
          host.country || 'global',
          host.name || host.username,
          host.avatar || ''
        );
      }

      if (opponent) {
        await redisRankingService.addPKScore(
          opponent.uid,
          0,
          opponentScore,
          opponent.country || 'global',
          opponent.name || opponent.username,
          opponent.avatar || ''
        );
      }
    } catch (error) {
      console.error('PK Battle Ranking Integration Error:', error.message);
    }
  }

  // ─── BATCH INITIALIZATION FROM MONGODB ──────────────────────────────────
  async initializeAllRankingsFromDB() {
    try {
      console.log('🔄 Initializing rankings from MongoDB...');

      const users = await User.find({ isActive: true, isBanned: false })
        .select('uid name avatar diamonds coins level vipLevel country totalGiftsSent totalGiftsReceived');

      for (const user of users) {
        const country = user.country || 'global';
        await redisRankingService.addWealthScore(
          user.uid,
          user.diamonds,
          country,
          user.name || user.username,
          user.avatar || ''
        );
        await redisRankingService.addCharmScore(
          user.uid,
          user.coins,
          country,
          user.name || user.username,
          user.avatar || ''
        );
      }

      const families = await Family.find({ isActive: true });
      for (const family of families) {
        await redisRankingService.addFamilyScore(
          family._id,
          family.members?.length || 0,
          family.country || 'global',
          family.name,
          family.icon || ''
        );
      }

      const agencies = await Agency.find({ isActive: true });
      for (const agency of agencies) {
        await redisRankingService.addAgencyScore(
          agency._id,
          agency.totalDiamonds || 0,
          agency.country || 'global',
          agency.name,
          agency.logo || ''
        );
      }

      const rooms = await Room.find({ isActive: true });
      for (const room of rooms) {
        await redisRankingService.addRoomScore(
          room._id,
          room.viewerCount || 0,
          room.country || 'global',
          room.name,
          ''
        );
      }

      console.log('✅ Rankings initialized from MongoDB');
      return { success: true, usersInitialized: users.length };
    } catch (error) {
      console.error('Ranking Initialization Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async initializeGiftRankingsFromDB() {
    try {
      const GiftTransaction = require('../models/GiftTransaction');
      const transactions = await GiftTransaction.find({})
        .populate('giftId')
        .limit(10000);

      const giftCounts = {};
      for (const tx of transactions) {
        const giftId = tx.giftId?._id?.toString() || tx.giftId?.toString();
        if (!giftId) continue;

        if (!giftCounts[giftId]) {
          giftCounts[giftId] = {
            count: 0,
            giftName: tx.giftId?.name || 'Unknown Gift',
            giftIcon: tx.giftId?.icon || ''
          };
        }
        giftCounts[giftId].count += 1;
      }

      for (const [giftId, data] of Object.entries(giftCounts)) {
        await redisRankingService.addGiftUsage(
          giftId,
          'system',
          data.count,
          'global',
          data.giftName,
          data.giftIcon
        );
      }

      console.log(`✅ Gift rankings initialized: ${Object.keys(giftCounts).length} gifts`);
      return { success: true, giftsInitialized: Object.keys(giftCounts).length };
    } catch (error) {
      console.error('Gift Ranking Initialization Error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new RedisRankingIntegration();