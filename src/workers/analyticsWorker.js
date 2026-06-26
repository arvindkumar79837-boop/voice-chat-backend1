const analyticsService = require('../services/analytics.service');
const Logger = require('../utils/logger');

/**
 * =================================================================
 * ARVIND PARTY - ANALYTICS AGGREGATION WORKER
 * =================================================================
 * Runs daily aggregation jobs and periodic updates.
 * Manages the schedule for all analytics data processing.
 * =================================================================
 */

class AnalyticsWorker {
  constructor(io) {
    this.io = io;
    this.dailyJobInterval = null;
    this.hourlyJobInterval = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      Logger.info('[AnalyticsWorker] Already running');
      return;
    }
    this.isRunning = true;
    Logger.info('[AnalyticsWorker] Starting analytics worker...');

    // Run initial revenue summary on start
    this.runRevenueUpdate();

    // Schedule revenue summary update every 15 minutes
    setInterval(() => {
      this.runRevenueUpdate();
    }, 15 * 60 * 1000);

    // Schedule daily aggregation at midnight (check every minute)
    this.scheduleDailyAggregation();

    // Schedule hourly aggregation for user activity
    this.hourlyJobInterval = setInterval(() => {
      this.runHourlyActivityAggregation();
    }, 60 * 60 * 1000);

    // Start the hourly aggregation immediately as well
    setTimeout(() => {
      this.runHourlyActivityAggregation();
    }, 60000);

    Logger.info('[AnalyticsWorker] All intervals scheduled');
  }

  async runRevenueUpdate() {
    try {
      const summary = await analyticsService.updateRevenueSummary(this.io);
      Logger.info(`[AnalyticsWorker] Revenue summary updated: ₹${summary?.totalRevenue || 0}`);
    } catch (error) {
      Logger.error('[AnalyticsWorker] Revenue update error:', error.message);
    }
  }

  async runDailyAggregation() {
    try {
      Logger.info('[AnalyticsWorker] Starting daily aggregation...');
      const result = await analyticsService.aggregateDailyStats();
      Logger.info(`[AnalyticsWorker] Daily aggregation complete:`, result);

      // Refresh everything after aggregation
      await analyticsService.updateRevenueSummary(this.io);

      // Notify all analytics socket clients
      if (this.io) {
        this.io.of('/analytics').emit('daily_aggregation_complete', {
          timestamp: new Date().toISOString(),
          ...result
        });
      }
    } catch (error) {
      Logger.error('[AnalyticsWorker] Daily aggregation error:', error.message);
    }
  }

  async runHourlyActivityAggregation() {
    try {
      // Quick user activity snapshot - update online counts
      const User = require('../models/User');
      const UserActivity = require('../models/UserActivity');

      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const onlineUsers = await User.find({ isOnline: true }).select('_id').lean();

      for (const user of onlineUsers) {
        await UserActivity.findOneAndUpdate(
          { userId: user._id, date: startOfToday },
          {
            $setOnInsert: { userId: user._id, date: startOfToday },
            $set: { isActive: true, lastSeenAt: new Date() },
            $inc: { sessionsCount: 1, timeSpentMinutes: 60 }
          },
          { upsert: true }
        );
      }

      Logger.info(`[AnalyticsWorker] Hourly activity: ${onlineUsers.length} online users processed`);
    } catch (error) {
      Logger.error('[AnalyticsWorker] Hourly activity error:', error.message);
    }
  }

  scheduleDailyAggregation() {
    const checkAndRun = () => {
      const now = new Date();
      // Run at midnight (00:00-00:01) and also at noon (12:00-12:01) for refresh
      if ((now.getHours() === 0 && now.getMinutes() === 0) ||
          (now.getHours() === 12 && now.getMinutes() === 0)) {
        this.runDailyAggregation();
      }
    };

    // Check every minute for scheduled times
    this.dailyJobInterval = setInterval(checkAndRun, 60000);

    // Also run once after 2 minutes of startup to ensure initial data
    setTimeout(() => {
      this.runDailyAggregation();
    }, 120000);
  }

  stop() {
    this.isRunning = false;
    if (this.dailyJobInterval) {
      clearInterval(this.dailyJobInterval);
      this.dailyJobInterval = null;
    }
    if (this.hourlyJobInterval) {
      clearInterval(this.hourlyJobInterval);
      this.hourlyJobInterval = null;
    }
    Logger.info('[AnalyticsWorker] Stopped');
  }
}

module.exports = AnalyticsWorker;