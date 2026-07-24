const jwt = require('jsonwebtoken');
const analyticsService = require('../services/analytics.service');
const Logger = require('../utils/logger');

const analyticsSocket = (io) => {
  const analyticsNamespace = io.of('/analytics');

  analyticsNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication token required for analytics'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      if (!['admin', 'owner', 'superadmin'].includes(decoded.role)) {
        return next(new Error('Insufficient permissions for analytics'));
      }
      next();
    } catch (error) {
      return next(new Error('Invalid or expired token'));
    }
  });

  analyticsNamespace.on('connection', (socket) => {
    const { userId, userRole } = socket;
    Logger.info(`📊 Analytics Namespace: User ${userId} (${userRole}) connected`);

    if (['admin', 'owner'].includes(userRole)) {
      socket.join('dashboard_viewers');
    }

    const intervals = [];

    const sendInitial = async () => {
      try {
        const [revenueSummary, userAnalytics, liveAnalytics, chartData] = await Promise.all([
          analyticsService.getRevenueSummary(),
          analyticsService.getUserAnalytics(),
          analyticsService.getLiveAnalytics(),
          analyticsService.getLiveChartData(),
        ]);
        socket.emit('initial_data', {
          revenueSummary,
          userAnalytics,
          liveAnalytics,
          chartData,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        Logger.error('Analytics initial data error:', error.message);
      }
    };
    sendInitial();

    socket.on('request_revenue_update', async () => {
      try { await analyticsService.updateRevenueSummary(io); }
      catch (error) { socket.emit('error', { message: 'Failed to update revenue summary' }); }
    });

    socket.on('request_live_update', async () => {
      try {
        const liveData = await analyticsService.getLiveAnalytics();
        socket.emit('live_analytics_updated', liveData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get live analytics' });
      }
    });

    socket.on('request_agency_update', async () => {
      try {
        const agencyData = await analyticsService.getAgencyAnalytics({ limit: 50 });
        socket.emit('agency_analytics_updated', agencyData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get agency analytics' });
      }
    });

    socket.on('request_family_update', async () => {
      try {
        const familyData = await analyticsService.getFamilyAnalytics({ limit: 50 });
        socket.emit('family_analytics_updated', familyData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get family analytics' });
      }
    });

    socket.on('request_chart_update', async () => {
      try {
        const chartData = await analyticsService.getLiveChartData();
        socket.emit('chart_data_updated', chartData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get chart data' });
      }
    });

    socket.on('request_heatmap_update', async (data) => {
      try {
        const heatMapData = await analyticsService.getHeatMapData(data || {});
        socket.emit('heatmap_data_updated', heatMapData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get heat map data' });
      }
    });

    socket.on('request_gift_update', async () => {
      try {
        const giftData = await analyticsService.getGiftAnalytics();
        socket.emit('gift_analytics_updated', giftData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get gift analytics' });
      }
    });

    // Per-connection auto-broadcasts to avoid namespace-wide listener/timer leaks
    intervals.push(setInterval(async () => {
      try {
        const summary = await analyticsService.getRevenueSummary();
        socket.emit('revenue_summary_updated', summary);
      } catch (error) {
        Logger.error('Analytics broadcast (revenue):', error.message);
      }
    }, 60000));

    intervals.push(setInterval(async () => {
      try {
        const liveData = await analyticsService.getLiveAnalytics();
        socket.emit('live_analytics_updated', liveData);
      } catch (error) {
        Logger.error('Analytics broadcast (live):', error.message);
      }
    }, 30000));

    intervals.push(setInterval(async () => {
      try {
        const chartData = await analyticsService.getLiveChartData();
        socket.emit('chart_data_updated', chartData);
      } catch (error) {
        Logger.error('Analytics broadcast (chart):', error.message);
      }
    }, 60000));

    intervals.push(setInterval(async () => {
      try {
        const giftData = await analyticsService.getGiftAnalytics();
        socket.emit('gift_analytics_updated', giftData);
      } catch (error) {
        Logger.error('Analytics broadcast (gift):', error.message);
      }
    }, 120000));

    intervals.push(setInterval(async () => {
      try {
        const [agencyData, familyData] = await Promise.all([
          analyticsService.getAgencyAnalytics({ limit: 50 }),
          analyticsService.getFamilyAnalytics({ limit: 50 }),
        ]);
        socket.emit('agency_analytics_updated', agencyData);
        socket.emit('family_analytics_updated', familyData);
      } catch (error) {
        Logger.error('Analytics broadcast (departmental):', error.message);
      }
    }, 300000));

    intervals.push(setInterval(async () => {
      try {
        const heatMapData = await analyticsService.getHeatMapData({});
        socket.emit('heatmap_data_updated', heatMapData);
      } catch (error) {
        Logger.error('Analytics broadcast (heatmap):', error.message);
      }
    }, 300000));

    socket.on('disconnect', () => {
      Logger.info(`📊 Analytics Namespace: User ${userId} disconnected`);
      intervals.forEach(clearInterval);
    });
  });
};

module.exports = analyticsSocket;