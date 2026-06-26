const analyticsService = require('../services/analytics.service');
const catchAsync = require('../utils/catchAsync');

/**
 * =================================================================
 * ARVIND PARTY - LIVE ANALYTICS & REVENUE DASHBOARD CONTROLLER
 * =================================================================
 * Features 28-31: Full analytics pipeline
 * =================================================================
 */

// ═══════════════════════════════════════════════════════════════════
// [FEATURE 28] CORE REVENUE TRACKING
// ═══════════════════════════════════════════════════════════════════

const getRevenueSummary = catchAsync(async (req, res) => {
  const summary = await analyticsService.getRevenueSummary();
  if (!summary) {
    return res.status(200).json({
      success: true,
      data: {
        totalRevenue: 0, todayRevenue: 0, thisWeekRevenue: 0, thisMonthRevenue: 0,
        totalDiamondsEarned: 0, todayDiamondsEarned: 0, thisWeekDiamondsEarned: 0, thisMonthDiamondsEarned: 0,
        totalPayouts: 0, pendingWithdrawalsAmount: 0, activeRechargeUsers: 0,
        coinSellerTotalSales: 0, totalCommissionPaid: 0
      }
    });
  }
  res.status(200).json({ success: true, data: summary });
});

const getRechargeAnalytics = catchAsync(async (req, res) => {
  const options = {
    page: req.query.page, limit: req.query.limit, sortBy: req.query.sortBy,
    userId: req.query.userId, coinSellerId: req.query.coinSellerId,
    startDate: req.query.startDate, endDate: req.query.endDate
  };
  const result = await analyticsService.getRechargeAnalytics(options);
  res.status(200).json({ success: true, ...result });
});

const getWithdrawalAnalytics = catchAsync(async (req, res) => {
  const options = {
    page: req.query.page, limit: req.query.limit, sortBy: req.query.sortBy,
    status: req.query.status, agencyId: req.query.agencyId,
    startDate: req.query.startDate, endDate: req.query.endDate
  };
  const result = await analyticsService.getWithdrawalAnalytics(options);
  res.status(200).json({ success: true, ...result });
});

const triggerRevenueSummaryUpdate = catchAsync(async (req, res) => {
  const io = req.app.get('io');
  analyticsService.updateRevenueSummary(io);
  res.status(202).json({ success: true, message: 'Revenue summary update triggered.' });
});

// ═══════════════════════════════════════════════════════════════════
// [FEATURE 29] LIVE BEHAVIOR & APP ENGAGEMENT
// ═══════════════════════════════════════════════════════════════════

const getUserAnalytics = catchAsync(async (req, res) => {
  const result = await analyticsService.getUserAnalytics(req.query);
  res.status(200).json({ success: true, data: result });
});

const getLiveAnalytics = catchAsync(async (req, res) => {
  const result = await analyticsService.getLiveAnalytics();
  res.status(200).json({ success: true, data: result });
});

const getGiftAnalytics = catchAsync(async (req, res) => {
  const options = {
    startDate: req.query.startDate, endDate: req.query.endDate,
    limit: req.query.limit
  };
  const result = await analyticsService.getGiftAnalytics(options);
  res.status(200).json({ success: true, data: result });
});

// ═══════════════════════════════════════════════════════════════════
// [FEATURE 30] DEPARTMENTAL PERFORMANCE
// ═══════════════════════════════════════════════════════════════════

const getAgencyAnalytics = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit, sortBy: req.query.sortBy
  };
  const result = await analyticsService.getAgencyAnalytics(options);
  res.status(200).json({ success: true, data: result });
});

const getFamilyAnalytics = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit, sortBy: req.query.sortBy
  };
  const result = await analyticsService.getFamilyAnalytics(options);
  res.status(200).json({ success: true, data: result });
});

// ═══════════════════════════════════════════════════════════════════
// [FEATURE 31] ADVANCED DATA VISUALIZATION
// ═══════════════════════════════════════════════════════════════════

const getLiveChartData = catchAsync(async (req, res) => {
  const result = await analyticsService.getLiveChartData();
  res.status(200).json({ success: true, data: result });
});

const getHeatMapData = catchAsync(async (req, res) => {
  const options = {
    country: req.query.country, date: req.query.date
  };
  const result = await analyticsService.getHeatMapData(options);
  res.status(200).json({ success: true, data: result });
});

const triggerDailyAggregation = catchAsync(async (req, res) => {
  const result = await analyticsService.aggregateDailyStats();
  const io = req.app.get('io');
  if (io) {
    io.of('/analytics').emit('daily_aggregation_complete', { timestamp: new Date(), ...result });
  }
  res.status(202).json({ success: true, message: 'Daily aggregation triggered.', data: result });
});

module.exports = {
  // Feature 28
  getRevenueSummary, getRechargeAnalytics, getWithdrawalAnalytics, triggerRevenueSummaryUpdate,
  // Feature 29
  getUserAnalytics, getLiveAnalytics, getGiftAnalytics,
  // Feature 30
  getAgencyAnalytics, getFamilyAnalytics,
  // Feature 31
  getLiveChartData, getHeatMapData,
  // Aggregation
  triggerDailyAggregation
};