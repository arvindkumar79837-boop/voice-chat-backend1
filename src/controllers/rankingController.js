const User = require('../models/User');
const redisRankingService = require('../services/redisRankingService');

exports.getTopWealth = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 100;

    const rankings = await redisRankingService.getWealthRanking(period, country, limit);

    if (rankings.length === 0) {
      const users = await User.find()
        .sort({ diamonds: -1 })
        .limit(limit)
        .select('uid name avatar diamonds level vipLevel country');

      for (const user of users) {
        await redisRankingService.addWealthScore(
          user.uid,
          user.diamonds,
          user.country || 'global',
          user.name || user.username,
          user.avatar || ''
        );
      }

      rankings.length = 0;
      const freshUsers = await redisRankingService.getWealthRanking(period, country, limit);
      rankings.push(...freshUsers);
    }

    const enriched = await Promise.all(
      rankings.map(async (entry) => {
        const user = await User.findOne({ uid: entry.memberId }).select('uid name avatar diamonds level vipLevel country');
        return {
          userId: entry.memberId,
          userName: entry.metadata?.username || user?.name || user?.username || 'Unknown',
          avatar: entry.metadata?.avatar || user?.avatar || '',
          score: entry.score,
          rank: await redisRankingService.getWealthRank(entry.memberId, period, country),
          country: entry.metadata?.country || user?.country || 'global'
        };
      })
    );

    res.status(200).json({ success: true, rankings: enriched });
  } catch (error) {
    console.error('Wealth Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch wealth rankings' });
  }
};

exports.getTopCharm = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 100;

    const rankings = await redisRankingService.getCharmRanking(period, country, limit);

    if (rankings.length === 0) {
      const users = await User.find()
        .sort({ coins: -1 })
        .limit(limit)
        .select('uid name avatar coins level vipLevel country');

      for (const user of users) {
        await redisRankingService.addCharmScore(
          user.uid,
          user.coins,
          user.country || 'global',
          user.name || user.username,
          user.avatar || ''
        );
      }

      rankings.length = 0;
      const freshUsers = await redisRankingService.getCharmRanking(period, country, limit);
      rankings.push(...freshUsers);
    }

    const enriched = await Promise.all(
      rankings.map(async (entry) => {
        const user = await User.findOne({ uid: entry.memberId }).select('uid name avatar coins level vipLevel country');
        return {
          userId: entry.memberId,
          userName: entry.metadata?.username || user?.name || user?.username || 'Unknown',
          avatar: entry.metadata?.avatar || user?.avatar || '',
          score: entry.score,
          rank: await redisRankingService.getCharmRank(entry.memberId, period, country),
          country: entry.metadata?.country || user?.country || 'global'
        };
      })
    );

    res.status(200).json({ success: true, rankings: enriched });
  } catch (error) {
    console.error('Charm Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch charm rankings' });
  }
};

exports.getGiftRanking = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 50;

    const rankings = await redisRankingService.getGiftRanking(period, country, limit);
    res.status(200).json({ success: true, rankings });
  } catch (error) {
    console.error('Gift Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch gift rankings' });
  }
};

exports.getFamilyRanking = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 50;

    const rankings = await redisRankingService.getFamilyRanking(period, country, limit);
    res.status(200).json({ success: true, rankings });
  } catch (error) {
    console.error('Family Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch family rankings' });
  }
};

exports.getAgencyRanking = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 50;

    const rankings = await redisRankingService.getAgencyRanking(period, country, limit);
    res.status(200).json({ success: true, rankings });
  } catch (error) {
    console.error('Agency Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch agency rankings' });
  }
};

exports.getRoomRanking = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 50;

    const rankings = await redisRankingService.getRoomRanking(period, country, limit);
    res.status(200).json({ success: true, rankings });
  } catch (error) {
    console.error('Room Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch room rankings' });
  }
};

exports.getPKRanking = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 50;

    const rankings = await redisRankingService.getPKRanking(period, country, limit);
    res.status(200).json({ success: true, rankings });
  } catch (error) {
    console.error('PK Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch PK rankings' });
  }
};

exports.getRichList = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 100;

    const rankings = await redisRankingService.getRichList(period, country, limit);
    res.status(200).json({ success: true, rankings });
  } catch (error) {
    console.error('Rich List Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rich list' });
  }
};

exports.getPopularList = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 100;

    const rankings = await redisRankingService.getPopularList(period, country, limit);
    res.status(200).json({ success: true, rankings });
  } catch (error) {
    console.error('Popular List Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch popular list' });
  }
};

exports.getMyRanks = async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?._id;
    const country = req.query.country || 'global';

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const ranks = await redisRankingService.getUserAllRanks(userId, country);
    res.status(200).json({ success: true, ranks });
  } catch (error) {
    console.error('My Ranks Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ranks' });
  }
};

exports.getAdminLeaderboard = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const country = req.query.country || 'global';
    const limit = parseInt(req.query.limit) || 50;

    const wealthRankings = await redisRankingService.getWealthRanking(period, country, limit);
    const charmRankings = await redisRankingService.getCharmRanking(period, country, limit);

    return res.status(200).json({
      success: true,
      data: {
        wealth: wealthRankings,
        charm: charmRankings
      }
    });
  } catch (error) {
    console.error('Admin Leaderboard Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
};

exports.resetLeaderboard = async (req, res) => {
  try {
    await User.updateMany({}, { $set: { coins: 0, diamonds: 0 } });

    const result = await redisRankingService.flushAll();
    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Failed to flush Redis cache' });
    }

    return res.status(200).json({ success: true, message: 'Leaderboard reset successfully', flushedKeys: result.flushed });
  } catch (error) {
    console.error('Reset Leaderboard Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset leaderboard' });
  }
};

exports.getRankingStats = async (req, res) => {
  try {
    const stats = await redisRankingService.getStats();
    res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('Ranking Stats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ranking stats' });
  }
};

exports.flushRankingCache = async (req, res) => {
  try {
    const period = req.query.period;

    let result;
    if (period) {
      result = await redisRankingService.flushPeriod(period);
    } else {
      result = await redisRankingService.flushAll();
    }

    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Flush Cache Error:', error);
    res.status(500).json({ success: false, message: 'Failed to flush ranking cache' });
  }
};