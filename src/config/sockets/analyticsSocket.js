const jwt = require('jsonwebtoken');
const analyticsService = require('../../services/analytics.service');

/**
 * =================================================================
 * ARVIND PARTY - ANALYTICS SOCKET NAMESPACE
 * =================================================================
 * Provides real-time data streaming for all analytics features.
 * Connected via socket.io-client to /analytics namespace.
 * =================================================================
 */

const setupAnalyticsSocket = (io) => {
  const analyticsNamespace = io.of('/analytics');

  // Authentication middleware for analytics namespace
  analyticsNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required for analytics'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;

      // Only allow admin and owner roles to access analytics
      if (!['admin', 'owner', 'superadmin'].includes(decoded.role)) {
        return next(new Error('Insufficient permissions for analytics'));
      }
      next();
    } catch (error) {
      return next(new Error('Invalid or expired token'));
    }
  });

  analyticsNamespace.on('connection', (socket) => {
    console.log(`📊 Analytics Socket connected: ${socket.userId} (role: ${socket.userRole})`);

    // Send initial data snapshot on connection
    Promise.all([
      analyticsService.getRevenueSummary(),
      analyticsService.getUserAnalytics(),
      analyticsService.getLiveAnalytics(),
      analyticsService.getLiveChartData()
    ]).then(([revenueSummary, userAnalytics, liveAnalytics, chartData]) => {
      socket.emit('initial_data', {
        revenueSummary,
        userAnalytics,
        liveAnalytics,
        chartData,
        timestamp: new Date().toISOString()
      });
    }).catch((error) => {
      console.error('Error sending initial analytics data:', error.message);
    });

    // Client requests revenue summary refresh
    socket.on('request_revenue_update', async () => {
      try {
        await analyticsService.updateRevenueSummary(io);
      } catch (error) {
        socket.emit('error', { message: 'Failed to update revenue summary' });
      }
    });

    // Client requests live analytics refresh
    socket.on('request_live_update', async () => {
      try {
        const liveData = await analyticsService.getLiveAnalytics();
        socket.emit('live_analytics_updated', liveData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get live analytics' });
      }
    });

    // Client requests agency analytics refresh
    socket.on('request_agency_update', async () => {
      try {
        const agencyData = await analyticsService.getAgencyAnalytics({ limit: 50 });
        socket.emit('agency_analytics_updated', agencyData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get agency analytics' });
      }
    });

    // Client requests family analytics refresh
    socket.on('request_family_update', async () => {
      try {
        const familyData = await analyticsService.getFamilyAnalytics({ limit: 50 });
        socket.emit('family_analytics_updated', familyData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get family analytics' });
      }
    });

    // Client requests chart data refresh
    socket.on('request_chart_update', async () => {
      try {
        const chartData = await analyticsService.getLiveChartData();
        socket.emit('chart_data_updated', chartData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get chart data' });
      }
    });

    // Client requests heat map data refresh
    socket.on('request_heatmap_update', async (data) => {
      try {
        const heatMapData = await analyticsService.getHeatMapData(data || {});
        socket.emit('heatmap_data_updated', heatMapData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get heat map data' });
      }
    });

    // Client requests gift analytics
    socket.on('request_gift_update', async () => {
      try {
        const giftData = await analyticsService.getGiftAnalytics();
        socket.emit('gift_analytics_updated', giftData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get gift analytics' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`📊 Analytics Socket disconnected: ${socket.userId}`);
    });
  });

  // ─── AUTOMATIC BROADCAST JOBS ──────────────────────────────────

  // Broadcast revenue summary every 60 seconds
  setInterval(async () => {
    try {
      const summary = await analyticsService.getRevenueSummary();
      analyticsNamespace.emit('revenue_summary_updated', summary);
    } catch (error) {
      console.error('Analytics broadcast (revenue):', error.message);
    }
  }, 60000);

  // Broadcast live analytics every 30 seconds
  setInterval(async () => {
    try {
      const liveData = await analyticsService.getLiveAnalytics();
      analyticsNamespace.emit('live_analytics_updated', liveData);
    } catch (error) {
      console.error('Analytics broadcast (live):', error.message);
    }
  }, 30000);

  // Broadcast chart data every 60 seconds
  setInterval(async () => {
    try {
      const chartData = await analyticsService.getLiveChartData();
      analyticsNamespace.emit('chart_data_updated', chartData);
    } catch (error) {
      console.error('Analytics broadcast (chart):', error.message);
    }
  }, 60000);

  // Broadcast gift analytics every 2 minutes
  setInterval(async () => {
    try {
      const giftData = await analyticsService.getGiftAnalytics();
      analyticsNamespace.emit('gift_analytics_updated', giftData);
    } catch (error) {
      console.error('Analytics broadcast (gift):', error.message);
    }
  }, 120000);

  // Broadcast agency & family rankings every 5 minutes
  setInterval(async () => {
    try {
      const [agencyData, familyData] = await Promise.all([
        analyticsService.getAgencyAnalytics({ limit: 50 }),
        analyticsService.getFamilyAnalytics({ limit: 50 })
      ]);
      analyticsNamespace.emit('agency_analytics_updated', agencyData);
      analyticsNamespace.emit('family_analytics_updated', familyData);
    } catch (error) {
      console.error('Analytics broadcast (departmental):', error.message);
    }
  }, 300000);

  // Broadcast heat map data every 5 minutes
  setInterval(async () => {
    try {
      const heatMapData = await analyticsService.getHeatMapData({});
      analyticsNamespace.emit('heatmap_data_updated', heatMapData);
    } catch (error) {
      console.error('Analytics broadcast (heatmap):', error.message);
    }
  }, 300000);

  console.log('📊 Analytics Socket Namespace initialized with auto-broadcast intervals');
};

module.exports = setupAnalyticsSocket;