const express = require('express');
const analyticsController = require('../controllers/analytics.controller');

const router = express.Router();

/**
 * =================================================================
 * ARVIND PARTY - ANALYTICS API ROUTES
 * =================================================================
 * Features 28-31: Full analytics pipeline
 * Prefix: /api/analytics
 * =================================================================
 */

// ═══════════════════════════════════════════════════════════════════
// [FEATURE 28] CORE REVENUE TRACKING
// ═══════════════════════════════════════════════════════════════════

// GET /api/analytics/revenue/summary - Main revenue dashboard data
router.get('/revenue/summary', analyticsController.getRevenueSummary);

// GET /api/analytics/revenue/recharges - Recharge analytics with pagination/filtering
router.get('/revenue/recharges', analyticsController.getRechargeAnalytics);

// GET /api/analytics/revenue/withdrawals - Withdrawal analytics with pagination/filtering
router.get('/revenue/withdrawals', analyticsController.getWithdrawalAnalytics);

// POST /api/analytics/revenue/update-summary - Manually trigger summary recalculation
router.post('/revenue/update-summary', analyticsController.triggerRevenueSummaryUpdate);

// ═══════════════════════════════════════════════════════════════════
// [FEATURE 29] LIVE BEHAVIOR & APP ENGAGEMENT
// ═══════════════════════════════════════════════════════════════════

// GET /api/analytics/engagement/users - DAU, MAU, new registrations, avg time spent
router.get('/engagement/users', analyticsController.getUserAnalytics);

// GET /api/analytics/engagement/live - Live rooms, seats filled, online users
router.get('/engagement/live', analyticsController.getLiveAnalytics);

// GET /api/analytics/engagement/gifts - Top gifts, rooms with most gifts, progressive blasts
router.get('/engagement/gifts', analyticsController.getGiftAnalytics);

// ═══════════════════════════════════════════════════════════════════
// [FEATURE 30] DEPARTMENTAL PERFORMANCE
// ═══════════════════════════════════════════════════════════════════

// GET /api/analytics/performance/agencies - Agency rankings, top hosts, trends
router.get('/performance/agencies', analyticsController.getAgencyAnalytics);

// GET /api/analytics/performance/families - Family rankings, top contributors, trends
router.get('/performance/families', analyticsController.getFamilyAnalytics);

// ═══════════════════════════════════════════════════════════════════
// [FEATURE 31] ADVANCED DATA VISUALIZATION
// ═══════════════════════════════════════════════════════════════════

// GET /api/analytics/charts/live - Hourly revenue & diamonds chart data
router.get('/charts/live', analyticsController.getLiveChartData);

// GET /api/analytics/charts/heatmap - Geographic activity heat map data
router.get('/charts/heatmap', analyticsController.getHeatMapData);

// ═══════════════════════════════════════════════════════════════════
// ADMIN AGGREGATION
// ═══════════════════════════════════════════════════════════════════

// POST /api/analytics/aggregate/daily - Trigger daily stats aggregation
router.post('/aggregate/daily', analyticsController.triggerDailyAggregation);

module.exports = router;