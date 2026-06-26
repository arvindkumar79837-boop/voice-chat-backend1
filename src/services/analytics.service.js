const mongoose = require('mongoose');
const RevenueSummary = require('../models/RevenueSummary');
const UserActivity = require('../models/UserActivity');
const GiftAnalytic = require('../models/GiftAnalytic');
const AgencyAnalytic = require('../models/AgencyAnalytic');
const FamilyAnalytic = require('../models/FamilyAnalytic');
const HeatMapEntry = require('../models/HeatMapEntry');
const Recharge = require('../models/Recharge');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Room = require('../models/Room');
const Agency = require('../models/Agency');
const Family = require('../models/Family');
const GiftTransaction = require('../models/GiftTransaction');

/**
 * =================================================================
 * ARVIND PARTY - LIVE ANALYTICS & REVENUE DASHBOARD SERVICE
 * =================================================================
 * Features 28-31: Core Revenue, Live Engagement, Departmental, Charts
 * =================================================================
 */

// ─── [FEATURE 28] CORE REVENUE TRACKING ──────────────────────────────────

const updateRevenueSummary = async (io) => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [rechargeStats] = await Recharge.aggregate([
    { $match: { status: 'SUCCESS', verifiedByServer: true } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amountINR' },
        today: {
          $sum: { $cond: [{ $gte: ['$createdAt', startOfToday] }, '$amountINR', 0] }
        },
        thisWeek: {
          $sum: { $cond: [{ $gte: ['$createdAt', startOfWeek] }, '$amountINR', 0] }
        },
        thisMonth: {
          $sum: { $cond: [{ $gte: ['$createdAt', startOfMonth] }, '$amountINR', 0] }
        },
        uniqueUsersToday: {
          $addToSet: { $cond: [{ $gte: ['$createdAt', startOfToday] }, '$userId', null] }
        },
        uniqueUsersMonth: {
          $addToSet: { $cond: [{ $gte: ['$createdAt', startOfMonth] }, '$userId', null] }
        }
      }
    }
  ]);

  const [diamondStats] = await GiftTransaction.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: null,
        totalDiamonds: { $sum: '$diamondValue' },
        today: {
          $sum: { $cond: [{ $gte: ['$createdAt', startOfToday] }, '$diamondValue', 0] }
        },
        thisWeek: {
          $sum: { $cond: [{ $gte: ['$createdAt', startOfWeek] }, '$diamondValue', 0] }
        },
        thisMonth: {
          $sum: { $cond: [{ $gte: ['$createdAt', startOfMonth] }, '$diamondValue', 0] }
        }
      }
    }
  ]);

  const [withdrawalStats] = await Withdrawal.aggregate([
    { $match: { status: 'PAID' } },
    {
      $group: {
        _id: null,
        totalPayout: { $sum: '$amountINR' },
        pendingAmount: {
          $sum: { $cond: [{ $in: ['$status', ['PENDING', 'PROCESSING']] }, '$amountINR', 0] }
        }
      }
    }
  ]);

  const [commissionStats] = await Withdrawal.aggregate([
    { $match: { status: 'PAID' } },
    {
      $group: {
        _id: null,
        totalCommission: { $sum: { $ifNull: ['$commissionAmount', 0] } }
      }
    }
  ]);

  const coinSellerSales = await Recharge.aggregate([
    { $match: { status: 'SUCCESS', coinSellerId: { $ne: null } } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$amountINR' }
      }
    }
  ]);

  const summaryData = {
    totalRevenue: rechargeStats?.totalRevenue || 0,
    todayRevenue: rechargeStats?.today || 0,
    thisWeekRevenue: rechargeStats?.thisWeek || 0,
    thisMonthRevenue: rechargeStats?.thisMonth || 0,
    totalDiamondsEarned: diamondStats?.totalDiamonds || 0,
    todayDiamondsEarned: diamondStats?.today || 0,
    thisWeekDiamondsEarned: diamondStats?.thisWeek || 0,
    thisMonthDiamondsEarned: diamondStats?.thisMonth || 0,
    totalPayouts: withdrawalStats?.totalPayout || 0,
    pendingWithdrawalsAmount: withdrawalStats?.pendingAmount || 0,
    activeRechargeUsers: (rechargeStats?.uniqueUsersMonth || []).filter(u => u).length || 0,
    coinSellerTotalSales: coinSellerSales.length > 0 ? coinSellerSales[0].totalSales : 0,
    totalCommissionPaid: commissionStats?.totalCommission || 0
  };

  const updatedSummary = await RevenueSummary.findOneAndUpdate(
    { summaryId: 'main_summary' },
    { $set: summaryData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (io) {
    io.of('/analytics').emit('revenue_summary_updated', updatedSummary);
  }
  return updatedSummary;
};

const getRevenueSummary = async () => {
  return await RevenueSummary.findOne({ summaryId: 'main_summary' });
};

const getRechargeAnalytics = async (options) => {
  const { page = 1, limit = 10, sortBy = 'createdAt:desc', userId, coinSellerId, startDate, endDate } = options;
  const [sortField, sortOrder] = sortBy.split(':');

  const query = { status: 'SUCCESS' };
  if (userId) query.userId = new mongoose.Types.ObjectId(userId);
  if (coinSellerId) query.coinSellerId = new mongoose.Types.ObjectId(coinSellerId);
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const recharges = await Recharge.find(query)
    .populate('userId', 'uid username displayName avatar phone')
    .populate('coinSellerId', 'uid username displayName')
    .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalResults = await Recharge.countDocuments(query);

  const revenuePerSeller = await Recharge.aggregate([
    { $match: { status: 'SUCCESS', coinSellerId: { $ne: null } } },
    {
      $group: {
        _id: '$coinSellerId',
        totalSold: { $sum: '$amountINR' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 20 }
  ]);

  return {
    results: recharges,
    revenuePerSeller,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults
  };
};

const getWithdrawalAnalytics = async (options) => {
  const { page = 1, limit = 10, sortBy = 'createdAt:desc', status, agencyId, startDate, endDate } = options;
  const [sortField, sortOrder] = sortBy.split(':');

  const query = {};
  if (status) query.status = status;
  if (agencyId) {
    const agencyUsers = await User.find({ agencyId: new mongoose.Types.ObjectId(agencyId) }).select('_id');
    query.userId = { $in: agencyUsers.map(u => u._id) };
  }
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const withdrawals = await Withdrawal.find(query)
    .populate('userId', 'uid username displayName avatar agencyId')
    .populate({
      path: 'userId',
      populate: { path: 'agencyId', select: 'name' }
    })
    .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalResults = await Withdrawal.countDocuments(query);

  const pendingStats = await Withdrawal.aggregate([
    { $match: { status: { $in: ['PENDING', 'PROCESSING'] } } },
    { $group: { _id: null, totalPending: { $sum: '$amountINR' }, count: { $sum: 1 } } }
  ]);

  return {
    results: withdrawals,
    pendingStats: pendingStats.length > 0 ? pendingStats[0] : { totalPending: 0, count: 0 },
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults
  };
};

// ─── [FEATURE 29] LIVE BEHAVIOR & APP ENGAGEMENT ──────────────────────────

const getUserAnalytics = async (options = {}) => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [dauToday] = await UserActivity.aggregate([
    { $match: { date: { $gte: startOfToday }, isActive: true } },
    { $group: { _id: null, count: { $sum: 1 } } }
  ]);

  const [dauWeek] = await UserActivity.aggregate([
    { $match: { date: { $gte: sevenDaysAgo }, isActive: true } },
    { $group: { _id: '$userId' } },
    { $count: 'count' }
  ]);

  const [mau] = await UserActivity.aggregate([
    { $match: { date: { $gte: thirtyDaysAgo }, isActive: true } },
    { $group: { _id: '$userId' } },
    { $count: 'count' }
  ]);

  const newRegistrations = await User.countDocuments({
    createdAt: { $gte: startOfToday }
  });

  const avgTimeSpent = await UserActivity.aggregate([
    { $match: { date: { $gte: startOfToday } } },
    { $group: { _id: null, avgMinutes: { $avg: '$timeSpentMinutes' } } }
  ]);

  return {
    dau: dauToday?.count || 0,
    wau: dauWeek?.count || 0,
    mau: mau?.count || 0,
    newRegistrationsToday: newRegistrations,
    avgTimeSpentMinutes: Math.round(avgTimeSpent[0]?.avgMinutes || 0),
    totalActiveUsers: await User.countDocuments({ isOnline: true }),
    totalUsers: await User.countDocuments({})
  };
};

const getLiveAnalytics = async () => {
  const activeRooms = await Room.countDocuments({ status: 'live', isActive: true });
  const totalSeats = await Room.aggregate([
    { $match: { status: 'live', isActive: true } },
    { $group: { _id: null, total: { $sum: '$seatCapacity' } } }
  ]);
  const filledSeats = await Room.aggregate([
    { $match: { status: 'live', isActive: true } },
    { $group: { _id: null, total: { $sum: { $size: { $ifNull: ['$seatedUsers', []] } } } } }
  ]);

  return {
    activeVoiceRooms: activeRooms,
    totalSeats: totalSeats[0]?.total || 0,
    filledSeats: filledSeats[0]?.total || 0,
    onlineUsers: await User.countDocuments({ isOnline: true }),
    totalUsersInRooms: filledSeats[0]?.total || 0
  };
};

const getGiftAnalytics = async (options = {}) => {
  const { startDate, endDate, limit = 20 } = options;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const query = { date: { $gte: startOfToday } };
  if (startDate) query.date.$gte = new Date(startDate);
  if (endDate) query.date.$lte = new Date(endDate);

  const topGifts = await GiftAnalytic.find(query)
    .sort({ totalSentCount: -1 })
    .limit(limit)
    .lean();

  const topRoomsForGifts = await GiftTransaction.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: startOfToday } } },
    {
      $group: {
        _id: '$roomId',
        totalDiamondValue: { $sum: '$diamondValue' },
        totalGifts: { $sum: 1 },
        highestSingleGift: { $max: '$diamondValue' }
      }
    },
    { $sort: { totalDiamondValue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'rooms',
        localField: '_id',
        foreignField: '_id',
        as: 'room'
      }
    },
    { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        roomId: '$_id',
        roomName: { $ifNull: ['$room.name', 'Unknown Room'] },
        totalDiamondValue: 1,
        totalGifts: 1,
        highestSingleGift: 1
      }
    }
  ]);

  const progressiveBlasts = await GiftTransaction.aggregate([
    { $match: { status: 'completed', isProgressiveBlast: true, createdAt: { $gte: startOfToday } } },
    {
      $group: {
        _id: '$roomId',
        totalBlasts: { $sum: 1 },
        maxBlastValue: { $max: '$diamondValue' }
      }
    },
    { $sort: { maxBlastValue: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'rooms',
        localField: '_id',
        foreignField: '_id',
        as: 'room'
      }
    },
    { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        roomId: '$_id',
        roomName: { $ifNull: ['$room.name', 'Unknown Room'] },
        totalBlasts: 1,
        maxBlastValue: 1
      }
    }
  ]);

  return {
    topGifts,
    topRooms: topRoomsForGifts,
    progressiveBlasts
  };
};

// ─── [FEATURE 30] DEPARTMENTAL PERFORMANCE ────────────────────────────────

const getAgencyAnalytics = async (options = {}) => {
  const { limit = 20, sortBy = 'totalDiamondsEarned:desc' } = options;
  const [sortField, sortOrder] = sortBy.split(':');
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const agencyRankings = await AgencyAnalytic.find({ date: { $gte: startOfToday } })
    .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit)
    .lean();

  if (agencyRankings.length === 0) {
    const agencies = await Agency.find({ isActive: true }).populate('ownerId', 'username displayName').lean();
    const agencyIds = agencies.map(a => a._id);
    const hostCounts = await User.aggregate([
      { $match: { agencyId: { $in: agencyIds }, role: 'host' } },
      { $group: { _id: '$agencyId', count: { $sum: 1 } } }
    ]);
    const hostCountMap = {};
    hostCounts.forEach(h => { hostCountMap[h._id.toString()] = h.count; });

    return agencies.map((a, idx) => ({
      agencyId: a._id,
      agencyName: a.name,
      agencyOwnerId: a.ownerId?._id,
      agencyOwnerName: a.ownerId?.username || 'N/A',
      totalHosts: hostCountMap[a._id.toString()] || 0,
      activeHosts: 0,
      totalDiamondsEarned: 0,
      rankingPosition: idx + 1,
      trend: 'stable'
    }));
  }

  return agencyRankings;
};

const getFamilyAnalytics = async (options = {}) => {
  const { limit = 20, sortBy = 'rankingPoints:desc' } = options;
  const [sortField, sortOrder] = sortBy.split(':');
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const familyRankings = await FamilyAnalytic.find({ date: { $gte: startOfToday } })
    .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit)
    .lean();

  if (familyRankings.length === 0) {
    const families = await Family.find({ isActive: true }).populate('ownerId', 'username displayName').lean();
    return families.map((f, idx) => ({
      familyId: f._id,
      familyName: f.name,
      familyOwnerId: f.ownerId?._id,
      familyOwnerName: f.ownerId?.username || 'N/A',
      totalMembers: f.memberCount || 0,
      activeMembers: 0,
      rankingPoints: 0,
      rankingPosition: idx + 1,
      trend: 'stable'
    }));
  }

  return familyRankings;
};

// ─── [FEATURE 31] ADVANCED DATA VISUALIZATION ────────────────────────────

const getLiveChartData = async () => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const hourlyRevenue = await Recharge.aggregate([
    { $match: { status: 'SUCCESS', createdAt: { $gte: startOfToday } } },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        total: { $sum: '$amountINR' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const hourlyDiamonds = await GiftTransaction.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: startOfToday } } },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        total: { $sum: '$diamondValue' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const hourlyData = [];
  for (let h = 0; h < 24; h++) {
    const rev = hourlyRevenue.find(r => r._id === h);
    const diam = hourlyDiamonds.find(d => d._id === h);
    hourlyData.push({
      hour: h,
      revenue: rev?.total || 0,
      revenueCount: rev?.count || 0,
      diamonds: diam?.total || 0,
      diamondCount: diam?.count || 0
    });
  }

  const weeklyRevenue = await Recharge.aggregate([
    { $match: { status: 'SUCCESS', createdAt: { $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: '$amountINR' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return {
    hourly: hourlyData,
    weekly: weeklyRevenue
  };
};

const getHeatMapData = async (options = {}) => {
  const { country, date } = options;
  const today = date ? new Date(date) : new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const query = { date: { $gte: startOfToday } };
  if (country) query.country = country;

  const heatMapData = await HeatMapEntry.find(query)
    .sort({ activeUsers: -1 })
    .limit(100)
    .lean();

  if (heatMapData.length === 0) {
    const fallbackData = await UserActivity.aggregate([
      { $match: { date: { $gte: startOfToday }, country: { $ne: null } } },
      {
        $group: {
          _id: { country: '$country', state: '$state', city: '$city' },
          activeUsers: { $sum: 1 },
          totalTimeSpentMinutes: { $sum: '$timeSpentMinutes' },
          diamondsEarned: { $sum: '$diamondsEarned' }
        }
      },
      { $sort: { activeUsers: -1 } },
      { $limit: 100 }
    ]);

    return fallbackData.map(d => ({
      country: d._id.country,
      state: d._id.state,
      city: d._id.city,
      activeUsers: d.activeUsers,
      totalTimeSpentMinutes: d.totalTimeSpentMinutes,
      diamondsEarned: d.diamondsEarned
    }));
  }

  return heatMapData;
};

// ─── DAILY AGGREGATION JOBS ──────────────────────────────────────────────

const aggregateDailyStats = async () => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Aggregate user activity for each active user
  const userActivities = await User.aggregate([
    { $match: { isOnline: true } },
    {
      $project: {
        _id: 1,
        username: 1,
        isOnline: 1
      }
    }
  ]);

  for (const user of userActivities) {
    await UserActivity.findOneAndUpdate(
      { userId: user._id, date: startOfToday },
      {
        $setOnInsert: { userId: user._id, date: startOfToday },
        $set: { isActive: true, lastSeenAt: new Date() },
        $inc: { sessionsCount: 1, timeSpentMinutes: 1 }
      },
      { upsert: true }
    );
  }

  // Aggregate gift analytics
  const giftStats = await GiftTransaction.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: startOfToday } } },
    {
      $group: {
        _id: '$giftId',
        giftName: { $first: '$giftName' },
        giftCategory: { $first: '$giftCategory' },
        totalCount: { $sum: 1 },
        totalDiamondValue: { $sum: '$diamondValue' },
        uniqueSenders: { $addToSet: '$senderId' },
        uniqueReceivers: { $addToSet: '$receiverId' },
        topRoom: { $last: '$roomId' },
        isProgressiveBlast: { $max: { $cond: ['$isProgressiveBlast', 1, 0] } }
      }
    }
  ]);

  for (const gift of giftStats) {
    const roomInfo = gift.topRoom ? await Room.findById(gift.topRoom).select('name').lean() : null;
    await GiftAnalytic.findOneAndUpdate(
      { giftId: gift._id, date: startOfToday },
      {
        $set: {
          giftName: gift.giftName,
          giftCategory: gift.giftCategory,
          topRoomName: roomInfo?.name || '',
          topRoomId: gift.topRoom,
          topRoomGiftCount: gift.totalCount,
          topRoomDiamondValue: gift.totalDiamondValue
        },
        $inc: {
          totalSentCount: gift.totalCount,
          totalDiamondValue: gift.totalDiamondValue,
          progressiveBlastCount: gift.isProgressiveBlast ? 1 : 0
        }
      },
      { upsert: true }
    );
  }

  // Aggregate agency analytics
  const agencies = await Agency.find({ isActive: true }).lean();
  for (const agency of agencies) {
    const hostIds = await User.find({ agencyId: agency._id, role: 'host' }).select('_id').lean();
    const hostIdList = hostIds.map(h => h._id);
    const activeHostIds = await User.find({ _id: { $in: hostIdList }, isOnline: true }).select('_id').lean();

    const agencyDiamonds = await GiftTransaction.aggregate([
      { $match: { receiverId: { $in: hostIdList }, status: 'completed', createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$diamondValue' }, count: { $sum: 1 } } }
    ]);

    const topHost = await GiftTransaction.aggregate([
      { $match: { receiverId: { $in: hostIdList }, status: 'completed', createdAt: { $gte: startOfToday } } },
      { $group: { _id: '$receiverId', totalDiamonds: { $sum: '$diamondValue' } } },
      { $sort: { totalDiamonds: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
    ]);

    const previousRanking = await AgencyAnalytic.findOne({ agencyId: agency._id }).sort({ date: -1 }).lean();
    const currentDiamonds = agencyDiamonds[0]?.total || 0;
    const previousDiamonds = previousRanking?.totalDiamondsEarned || 0;
    let trend = 'stable';
    if (currentDiamonds > previousDiamonds) trend = 'up';
    else if (currentDiamonds < previousDiamonds) trend = 'down';

    await AgencyAnalytic.findOneAndUpdate(
      { agencyId: agency._id, date: startOfToday },
      {
        $set: {
          agencyName: agency.name,
          agencyOwnerId: agency.ownerId,
          totalHosts: hostIdList.length,
          activeHosts: activeHostIds.length,
          topHostId: topHost[0]?._id || null,
          topHostName: topHost[0]?.user?.username || '',
          topHostDiamonds: topHost[0]?.totalDiamonds || 0,
          trend
        },
        $inc: { totalDiamondsEarned: currentDiamonds }
      },
      { upsert: true }
    );
  }

  // Update agency rankings
  const allAgencyAnalytics = await AgencyAnalytic.find({ date: startOfToday })
    .sort({ totalDiamondsEarned: -1 })
    .lean();

  for (let i = 0; i < allAgencyAnalytics.length; i++) {
    await AgencyAnalytic.findOneAndUpdate(
      { _id: allAgencyAnalytics[i]._id },
      {
        $set: {
          rankingPosition: i + 1,
          previousRankingPosition: allAgencyAnalytics[i].rankingPosition
        }
      }
    );
  }

  // Aggregate family analytics
  const families = await Family.find({ isActive: true }).lean();
  for (const family of families) {
    const familyUserIds = await User.find({ familyId: family._id }).select('_id').lean();
    const famUserIdList = familyUserIds.map(u => u._id);
    const activeFamMembers = await User.find({ _id: { $in: famUserIdList }, isOnline: true }).countDocuments();

    const familyDiamonds = await GiftTransaction.aggregate([
      { $match: { senderId: { $in: famUserIdList }, status: 'completed', createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$diamondValue' }, count: { $sum: 1 } } }
    ]);

    const familyGifts = await GiftTransaction.aggregate([
      { $match: { $or: [{ senderId: { $in: famUserIdList } }, { receiverId: { $in: famUserIdList } }], status: 'completed', createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, sent: { $sum: 1 }, received: { $sum: 1 } } }
    ]);

    const topContributor = await GiftTransaction.aggregate([
      { $match: { senderId: { $in: famUserIdList }, status: 'completed', createdAt: { $gte: startOfToday } } },
      { $group: { _id: '$senderId', totalDiamonds: { $sum: '$diamondValue' } } },
      { $sort: { totalDiamonds: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
    ]);

    const famPrevRanking = await FamilyAnalytic.findOne({ familyId: family._id }).sort({ date: -1 }).lean();
    let famTrend = 'stable';
    if (familyDiamonds[0]?.total > (famPrevRanking?.totalDiamondsEarned || 0)) famTrend = 'up';
    else if (familyDiamonds[0]?.total < (famPrevRanking?.totalDiamondsEarned || 0)) famTrend = 'down';

    await FamilyAnalytic.findOneAndUpdate(
      { familyId: family._id, date: startOfToday },
      {
        $set: {
          familyName: family.name,
          familyOwnerId: family.ownerId,
          totalMembers: famUserIdList.length,
          activeMembers: activeFamMembers,
          topContributorId: topContributor[0]?._id || null,
          topContributorName: topContributor[0]?.user?.username || '',
          topContributorDiamonds: topContributor[0]?.totalDiamonds || 0,
          totalGiftsSent: familyGifts[0]?.sent || 0,
          totalGiftsReceived: familyGifts[0]?.received || 0,
          trend: famTrend
        },
        $inc: {
          totalDiamondsEarned: familyDiamonds[0]?.total || 0,
          totalDiamondsSpent: familyDiamonds[0]?.total || 0,
          rankingPoints: Math.floor((familyDiamonds[0]?.total || 0) / 100)
        }
      },
      { upsert: true }
    );
  }

  // Update family rankings
  const allFamilyAnalytics = await FamilyAnalytic.find({ date: startOfToday })
    .sort({ rankingPoints: -1 })
    .lean();

  for (let i = 0; i < allFamilyAnalytics.length; i++) {
    await FamilyAnalytic.findOneAndUpdate(
      { _id: allFamilyAnalytics[i]._id },
      {
        $set: {
          rankingPosition: i + 1,
          previousRankingPosition: allFamilyAnalytics[i].rankingPosition
        }
      }
    );
  }

  // Aggregate heat map data
  const heatMapResults = await UserActivity.aggregate([
    { $match: { date: { $gte: startOfToday }, country: { $ne: null } } },
    {
      $group: {
        _id: { country: '$country', state: { $ifNull: ['$state', ''] }, city: { $ifNull: ['$city', ''] }, hour: { $hour: '$lastSeenAt' }, dayOfWeek: { $dayOfWeek: '$date' } },
        activeUsers: { $sum: 1 },
        sessionsCount: { $sum: '$sessionsCount' },
        totalTimeSpentMinutes: { $sum: '$timeSpentMinutes' },
        roomsJoined: { $sum: '$roomsJoined' },
        giftsSent: { $sum: '$giftsSent' },
        diamondsEarned: { $sum: '$diamondsEarned' },
        diamondsSpent: { $sum: '$diamondsSpent' }
      }
    },
    { $limit: 1000 }
  ]);

  for (const entry of heatMapResults) {
    await HeatMapEntry.findOneAndUpdate(
      {
        country: entry._id.country,
        state: entry._id.state,
        city: entry._id.city,
        hour: entry._id.hour,
        dayOfWeek: entry._id.dayOfWeek,
        date: startOfToday
      },
      {
        $set: {
          activeUsers: entry.activeUsers,
          sessionsCount: entry.sessionsCount,
          totalTimeSpentMinutes: entry.totalTimeSpentMinutes,
          roomsJoined: entry.roomsJoined,
          giftsSent: entry.giftsSent,
          diamondsEarned: entry.diamondsEarned,
          diamondsSpent: entry.diamondsSpent
        }
      },
      { upsert: true }
    );
  }

  return {
    userActivitiesProcessed: userActivities.length,
    giftsProcessed: giftStats.length,
    agenciesProcessed: agencies.length,
    familiesProcessed: families.length,
    heatMapEntriesCreated: heatMapResults.length
  };
};

module.exports = {
  // Feature 28
  updateRevenueSummary,
  getRevenueSummary,
  getRechargeAnalytics,
  getWithdrawalAnalytics,
  // Feature 29
  getUserAnalytics,
  getLiveAnalytics,
  getGiftAnalytics,
  // Feature 30
  getAgencyAnalytics,
  getFamilyAnalytics,
  // Feature 31
  getLiveChartData,
  getHeatMapData,
  // Aggregation
  aggregateDailyStats
};