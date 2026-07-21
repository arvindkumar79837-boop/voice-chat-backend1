// =========================================================================
// UNIT TESTS - Health Controller
// Quality Assurance Test Suite
// =========================================================================

const mongoose = require('mongoose');

// Mock Mongoose with a realistic connection object structure
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connection: {
      readyState: 1,
      host: 'localhost',
      name: 'test_db',
      collections: { users: {}, gifts: {} },
      db: {
        admin: () => ({
          ping: jest.fn().mockResolvedValue(true)
        })
      }
    }
  };
});

// Mock services
jest.mock('../src/services/queueService');
jest.mock('../src/services/monitoringService');

const HealthController = require('../src/controllers/healthController');
const QueueService = require('../src/services/queueService');
const MonitoringService = require('../src/services/monitoringService');

describe('HealthController', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
    
    // Reset connection mock state before each test
    mongoose.connection.readyState = 1;
    mongoose.connection.host = 'localhost';
    mongoose.connection.name = 'test_db';
    mongoose.connection.collections = { users: {}, gifts: {} };
  });

  describe('getSimpleHealth', () => {
    it('should return healthy status when database is connected', async () => {
      mongoose.connection.readyState = 1;

      await HealthController.getSimpleHealth(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'healthy',
        database: 'connected',
        timestamp: expect.any(String)
      });
    });

    it('should return unhealthy status when database is disconnected', async () => {
      mongoose.connection.readyState = 0;

      await HealthController.getSimpleHealth(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'unhealthy',
        database: 'disconnected'
      });
    });
  });

  describe('getMetrics', () => {
    it('should return metrics and health status', async () => {
      const mockMetrics = {
        requests: { total: 100, success: 95, failed: 5 },
        system: { cpu: { usage: 45 }, memory: { percentage: 60 } }
      };
      const mockHealth = { status: 'healthy', issues: [] };

      MonitoringService.getMetrics = jest.fn().mockReturnValue(mockMetrics);
      MonitoringService.getHealthStatus = jest.fn().mockReturnValue(mockHealth);

      await HealthController.getMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          metrics: mockMetrics,
          health: mockHealth
        }
      });
    });

    it('should handle errors gracefully', async () => {
      MonitoringService.getMetrics = jest.fn().mockImplementation(() => {
        throw new Error('Metrics error');
      });

      await HealthController.getMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch metrics',
        error: 'Metrics error'
      });
    });
  });

  describe('checkDatabase', () => {
    it('should pass when database is connected', async () => {
      mongoose.connection.readyState = 1;

      const health = { services: {}, checks: [] };
      await HealthController.checkDatabase(health);

      expect(health.services.database.connected).toBe(true);
      expect(health.checks).toContainEqual({
        name: 'database',
        status: 'pass',
        message: 'MongoDB connected',
        timestamp: expect.any(String)
      });
    });

    it('should fail when database is disconnected', async () => {
      mongoose.connection.readyState = 0;

      const health = { services: {}, checks: [], status: 'healthy' };
      await HealthController.checkDatabase(health);

      expect(health.services.database.connected).toBe(false);
      expect(health.status).toBe('unhealthy');
      expect(health.checks).toContainEqual({
        name: 'database',
        status: 'error',
        message: expect.any(String),
        timestamp: expect.any(String)
      });
    });
  });

  describe('checkRedis', () => {
    it('should pass when Redis is connected', async () => {
      QueueService.isHealthy = jest.fn().mockResolvedValue(true);

      const health = { services: {}, checks: [] };
      await HealthController.checkRedis(health);

      expect(health.services.redis.connected).toBe(true);
      expect(health.checks).toContainEqual({
        name: 'redis',
        status: 'pass',
        message: 'Redis connected',
        timestamp: expect.any(String)
      });
    });

    it('should show warning when Redis is not connected', async () => {
      QueueService.isHealthy = jest.fn().mockResolvedValue(false);

      const health = { services: {}, checks: [] };
      await HealthController.checkRedis(health);

      expect(health.services.redis.connected).toBe(false);
      expect(health.checks).toContainEqual({
        name: 'redis',
        status: 'warning',
        message: 'Redis not connected (using fallback)',
        timestamp: expect.any(String)
      });
    });
  });

  describe('checkSystemResources', () => {
    it('should pass when resources are normal', async () => {
      MonitoringService.getMemoryUsage = jest.fn().mockReturnValue({
        percentage: 50,
        total: 16384,
        used: 8192,
        free: 8192
      });
      MonitoringService.getCPUUsage = jest.fn().mockReturnValue({
        usage: 45,
        cores: 8
      });

      const health = { services: {}, checks: [], status: 'healthy' };
      await HealthController.checkSystemResources(health);

      expect(health.services.system.memory.percentage).toBe(50);
      expect(health.checks).toContainEqual({
        name: 'system',
        status: 'pass',
        message: expect.stringContaining('Memory: 50%'),
        timestamp: expect.any(String)
      });
    });

    it('should show error when memory usage is critical', async () => {
      MonitoringService.getMemoryUsage = jest.fn().mockReturnValue({
        percentage: 90,
        total: 16384,
        used: 14745,
        free: 1639
      });
      MonitoringService.getCPUUsage = jest.fn().mockReturnValue({
        usage: 45,
        cores: 8
      });

      const health = { services: {}, checks: [], status: 'healthy' };
      await HealthController.checkSystemResources(health);

      expect(health.status).toBe('unhealthy');
      expect(health.checks).toContainEqual({
        name: 'system',
        status: 'error',
        message: expect.stringContaining('90%'),
        timestamp: expect.any(String)
      });
    });

    it('should show warning when memory usage is high', async () => {
      MonitoringService.getMemoryUsage = jest.fn().mockReturnValue({
        percentage: 80,
        total: 16384,
        used: 13107,
        free: 3277
      });
      MonitoringService.getCPUUsage = jest.fn().mockReturnValue({
        usage: 45,
        cores: 8
      });

      const health = { services: {}, checks: [], status: 'healthy' };
      await HealthController.checkSystemResources(health);

      expect(health.status).toBe('healthy');
      expect(health.checks).toContainEqual({
        name: 'system',
        status: 'warning',
        message: expect.stringContaining('80%'),
        timestamp: expect.any(String)
      });
    });
  });

  describe('checkQueueService', () => {
    it('should pass when queue service is healthy', async () => {
      QueueService.isHealthy = jest.fn().mockResolvedValue(true);
      QueueService.getConnectedQueues = jest.fn().mockReturnValue(['gift-processing', 'notification']);

      const health = { services: {}, checks: [] };
      await HealthController.checkQueueService(health);

      expect(health.services.queue.healthy).toBe(true);
      expect(health.services.queue.count).toBe(2);
      expect(health.checks).toContainEqual({
        name: 'queue',
        status: 'pass',
        message: '2 queues active',
        timestamp: expect.any(String)
      });
    });

    it('should show warning when queue service is degraded', async () => {
      QueueService.isHealthy = jest.fn().mockResolvedValue(false);
      QueueService.getConnectedQueues = jest.fn().mockReturnValue([]);

      const health = { services: {}, checks: [] };
      await HealthController.checkQueueService(health);

      expect(health.services.queue.healthy).toBe(false);
      expect(health.checks).toContainEqual({
        name: 'queue',
        status: 'warning',
        message: 'Queue service degraded',
        timestamp: expect.any(String)
      });
    });
  });
});

describe('HealthController Integration', () => {
  it('getDetailedHealth should aggregate all checks', async () => {
    const mockReq = {};
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mongoose.connection.readyState = 1;
    mongoose.connection.host = 'localhost';
    mongoose.connection.name = 'test_db';
    mongoose.connection.collections = {};

    QueueService.isHealthy = jest.fn().mockResolvedValue(true);
    QueueService.getConnectedQueues = jest.fn().mockReturnValue(['gift-processing']);

    MonitoringService.getMemoryUsage = jest.fn().mockReturnValue({
      percentage: 50,
      total: 16384,
      used: 8192,
      free: 8192
    });
    MonitoringService.getCPUUsage = jest.fn().mockReturnValue({
      usage: 45,
      cores: 8
    });

    await HealthController.getDetailedHealth(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    const responseArg = mockRes.json.mock.calls[0][0];
    expect(responseArg.status).toBe('healthy');
    expect(responseArg.services).toHaveProperty('database');
    expect(responseArg.services).toHaveProperty('redis');
    expect(responseArg.services).toHaveProperty('system');
    expect(responseArg.checks.length).toBeGreaterThan(0);
  });

  it('getDetailedHealth should return degraded status with warnings', async () => {
    const mockReq = {};
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mongoose.connection.readyState = 1;
    QueueService.isHealthy = jest.fn().mockResolvedValue(true);
    QueueService.getConnectedQueues = jest.fn().mockReturnValue(['gift-processing']);

    MonitoringService.getMemoryUsage = jest.fn().mockReturnValue({
      percentage: 80,
      total: 16384,
      used: 13107,
      free: 3277
    });
    MonitoringService.getCPUUsage = jest.fn().mockReturnValue({
      usage: 45,
      cores: 8
    });

    await HealthController.getDetailedHealth(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    const responseArg = mockRes.json.mock.calls[0][0];
    expect(responseArg.status).toBe('degraded');
  });

  it('getDetailedHealth should return unhealthy status with failures', async () => {
    const mockReq = {};
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mongoose.connection.readyState = 0;
    QueueService.isHealthy = jest.fn().mockResolvedValue(true);
    QueueService.getConnectedQueues = jest.fn().mockReturnValue([]);

    MonitoringService.getMemoryUsage = jest.fn().mockReturnValue({
      percentage: 50,
      total: 16384,
      used: 8192,
      free: 8192
    });
    MonitoringService.getCPUUsage = jest.fn().mockReturnValue({
      usage: 45,
      cores: 8
    });

    await HealthController.getDetailedHealth(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    const responseArg = mockRes.json.mock.calls[0][0];
    expect(responseArg.status).toBe('unhealthy');
  });
});
