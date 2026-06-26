const express = require('express');
const router = express.Router();
const HealthController = require('../controllers/healthController');

/**
 * Health Check Routes
 * Provides comprehensive system health monitoring
 */

// Simple health check (for load balancers)
router.get('/health', HealthController.getSimpleHealth);

// Detailed health check with all services
router.get('/health/detailed', HealthController.getDetailedHealth);

// System metrics endpoint
router.get('/health/metrics', HealthController.getMetrics);

// Queue stats endpoint
router.get('/health/queues', async (req, res) => {
  try {
    const QueueService = require('../services/queueService');
    const queues = QueueService.getConnectedQueues();
    const statsPromises = queues.map(async (queueName) => {
      const stats = await QueueService.getQueueStats(queueName);
      return { queueName, stats };
    });
    const stats = await Promise.all(statsPromises);

    res.json({
      success: true,
      data: {
        totalQueues: queues.length,
        queues: stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queue stats',
      error: error.message
    });
  }
});

// Redis stats endpoint
router.get('/health/redis', async (req, res) => {
  try {
    const QueueService = require('../services/queueService');
    const redisInfo = await QueueService.getRedisClient();

    if (!redisInfo) {
      return res.json({
        success: true,
        data: {
          status: 'disconnected',
          message: 'Redis client not available'
        }
      });
    }

    const info = await redisInfo.info();
    res.json({
      success: true,
      data: {
        status: 'connected',
        info: info.split('\n').slice(0, 20).join('\n')
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Redis stats',
      error: error.message
    });
  }
});

// Readiness probe (Kubernetes)
router.get('/health/ready', (req, res) => {
  const dbReady = require('mongoose').connection.readyState === 1;
  
  if (dbReady) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready', reason: 'Database not connected' });
  }
});

// Liveness probe (Kubernetes)
router.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'alive', uptime: process.uptime() });
});

module.exports = router;