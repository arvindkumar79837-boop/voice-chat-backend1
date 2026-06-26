const mongoose = require('mongoose');
const redis = require('redis');
const QueueService = require('../services/queueService');
const MonitoringService = require('../services/monitoringService');

class HealthController {
  /**
   * Comprehensive health check endpoint
   * GET /api/health/detailed
   */
  static async getDetailedHealth(req, res) {
    const startTime = Date.now();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {},
      checks: []
    };

    try {
      await this.checkDatabase(health);
    } catch (error) {
      this.addCheck(health, 'database', 'error', error.message);
    }

    try {
      await this.checkRedis(health);
    } catch (error) {
      this.addCheck(health, 'redis', 'error', error.message);
    }

    try {
      await this.checkQueueService(health);
    } catch (error) {
      this.addCheck(health, 'queue', 'error', error.message);
    }

    try {
      await this.checkSystemResources(health);
    } catch (error) {
      this.addCheck(health, 'system', 'error', error.message);
    }

    try {
      await this.checkSocketIO(health);
    } catch (error) {
      this.addCheck(health, 'websocket', 'error', error.message);
    }

    const responseTime = Date.now() - startTime;
    health.responseTime = `${responseTime}ms`;

    const hasFailures = health.checks.some(check => check.status === 'error');
    const hasWarnings = health.checks.some(check => check.status === 'warning');

    if (hasFailures) {
      health.status = 'unhealthy';
      res.status(503).json(health);
    } else if (hasWarnings) {
      health.status = 'degraded';
      res.status(200).json(health);
    } else {
      health.status = 'healthy';
      res.status(200).json(health);
    }
  }

  /**
   * Simple health check for load balancers
   * GET /api/health
   */
  static async getSimpleHealth(req, res) {
    try {
      const dbStatus = mongoose.connection.readyState === 1;

      if (!dbStatus) {
        return res.status(503).json({
          status: 'unhealthy',
          database: 'disconnected'
        });
      }

      res.status(200).json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * Get system metrics for monitoring dashboards
   * GET /api/health/metrics
   */
  static async getMetrics(req, res) {
    try {
      const monitoringService = MonitoringService;
      const metrics = monitoringService.getMetrics();
      const healthStatus = monitoringService.getHealthStatus();

      res.json({
        success: true,
        data: {
          metrics,
          health: healthStatus
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch metrics',
        error: error.message
      });
    }
  }

  /**
   * Check MongoDB connection health
   */
  static async checkDatabase(health) {
    try {
      const dbState = mongoose.connection.readyState;
      const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };

      if (dbState === 1) {
        const stats = {
          connected: true,
          state: states[dbState],
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          collections: Object.keys(mongoose.connection.collections).length
        };

        health.services.database = stats;
        this.addCheck(health, 'database', 'pass', 'MongoDB connected');
      } else {
        health.services.database = { connected: false, state: states[dbState] };
        this.addCheck(health, 'database', 'error', `MongoDB ${states[dbState]}`);
        health.status = 'unhealthy';
      }
    } catch (error) {
      health.services.database = { connected: false, error: error.message };
      this.addCheck(health, 'database', 'error', error.message);
      health.status = 'unhealthy';
    }
  }

  /**
   * Check Redis connection health
   */
  static async checkRedis(health) {
    try {
      const rankingConnected = QueueService.isHealthy();
      
      health.services.redis = {
        connected: rankingConnected
      };

      if (rankingConnected) {
        this.addCheck(health, 'redis', 'pass', 'Redis connected');
      } else {
        this.addCheck(health, 'redis', 'warning', 'Redis not connected (using fallback)');
      }
    } catch (error) {
      health.services.redis = { connected: false, error: error.message };
      this.addCheck(health, 'redis', 'error', error.message);
    }
  }

  /**
   * Check Queue Service health
   */
  static async checkQueueService(health) {
    try {
      const queues = QueueService.getConnectedQueues();
      const isHealthy = await QueueService.isHealthy();

      health.services.queue = {
        healthy: isHealthy,
        queues: queues,
        count: queues.length
      };

      if (isHealthy) {
        this.addCheck(health, 'queue', 'pass', `${queues.length} queues active`);
      } else {
        this.addCheck(health, 'queue', 'warning', 'Queue service degraded');
      }
    } catch (error) {
      health.services.queue = { healthy: false, error: error.message };
      this.addCheck(health, 'queue', 'error', error.message);
    }
  }

  /**
   * Check system resources (CPU, Memory)
   */
  static async checkSystemResources(health) {
    const monitoringService = MonitoringService;
    const sysInfo = monitoringService.getMemoryUsage();
    const cpuInfo = monitoringService.getCPUUsage();

    health.services.system = {
      memory: sysInfo,
      cpu: cpuInfo
    };

    if (sysInfo.percentage > 85) {
      this.addCheck(health, 'system', 'error', `Memory usage critical: ${sysInfo.percentage}%`);
      health.status = 'unhealthy';
    } else if (sysInfo.percentage > 75) {
      this.addCheck(health, 'system', 'warning', `Memory usage high: ${sysInfo.percentage}%`);
    } else {
      this.addCheck(health, 'system', 'pass', `Memory: ${sysInfo.percentage}%, CPU: ${cpuInfo.usage.toFixed(2)}%`);
    }

    if (cpuInfo.usage > 80) {
      this.addCheck(health, 'cpu', 'warning', `CPU usage high: ${cpuInfo.usage.toFixed(2)}%`);
    }
  }

  /**
   * Check Socket.IO health
   */
  static async checkSocketIO(health) {
    try {
      const io = req.app.get('io');
      
      if (!io) {
        this.addCheck(health, 'websocket', 'error', 'Socket.IO not initialized');
        return;
      }

      const sockets = io.sockets;
      const connectedSockets = sockets.sockets.size;
      const rooms = sockets.adapter.rooms;

      let totalRooms = 0;
      for (const room in rooms) {
        if (rooms[room].hasOwnProperty('sockets')) {
          totalRooms++;
        }
      }

      health.services.websocket = {
        connected: true,
        activeConnections: connectedSockets,
        activeRooms: totalRooms
      };

      this.addCheck(health, 'websocket', 'pass', `${connectedSockets} connections in ${totalRooms} rooms`);
    } catch (error) {
      health.services.websocket = { connected: false, error: error.message };
      this.addCheck(health, 'websocket', 'error', error.message);
    }
  }

  /**
   * Helper to add a check result
   */
  static addCheck(health, name, status, message) {
    health.checks.push({
      name,
      status,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = HealthController;