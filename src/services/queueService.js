const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Patch BullMQ to accept Redis 3.x for older Redis servers
try {
  const RedisConnModule = require('bullmq/dist/classes/redis-connection.js');

  if (RedisConnModule.RedisConnection && typeof RedisConnModule.RedisConnection.minimumVersion === 'string') {
    const originalMinVersion = RedisConnModule.RedisConnection.minimumVersion;
    RedisConnModule.RedisConnection.minimumVersion = '3.0.0';
    Logger.info(`🔧 Patched BullMQ Redis version check: ${originalMinVersion} → 3.0.0`);
  }
} catch (patchError) {
  Logger.info(`⚠️ BullMQ patch skipped: ${patchError.message}`);
}
const Logger = require('../utils/logger');

class QueueService {
  constructor() {
    this.redisClient = null;
    this.queues = {};
    this.isConnected = false;
  }

  async connect() {
    try {
      let redisOptions = {};

      if (process.env.REDIS_URL) {
        redisOptions = {
          url: process.env.REDIS_URL,
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: true,
          retryStrategy: (times) => Math.min(times * 50, 1000)
        };
      } else {
        redisOptions = {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
          retryStrategy: (times) => Math.min(times * 50, 1000),
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: true
        };
      }

      this.redisClient = new Redis(redisOptions);

      this.redisClient.on('error', (err) => {
        Logger.error('❌ Queue Redis Error:', err.message);
        this.isConnected = false;
      });

      this.redisClient.on('connect', () => {
        Logger.info('🔄 Queue Redis Client Connected');
      });

      this.redisClient.on('ready', () => {
        Logger.info('✅ Queue Redis Client Ready');
        this.isConnected = true;
      });

      const connectPromise = this.redisClient.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Queue Redis connection timeout after 5s')), 5000)
      );
      await Promise.race([connectPromise, timeoutPromise]);
      this.isConnected = true;
      Logger.info('✅ Queue Service Connected');
      return true;
    } catch (error) {
      Logger.error('⚠️ Queue Service Connection Failed:', error.message);
      return false;
    }
  }

  getRedisClient() {
    return this.redisClient;
  }

  getQueueConnection() {
    return this.redisClient;
  }

  async createQueue(queueName, options = {}) {
    if (!this.isConnected) {
      Logger.warn(`⚠️ Queue service not connected - skipping queue creation for ${queueName}`);
      return null;
    }

    if (this.queues[queueName]) {
      return this.queues[queueName];
    }

    const defaultOptions = {
      connection: this.getQueueConnection(),
      enableReadyCheck: false,  // Skip Redis version check for compatibility
      defaultJobOptions: {
        removeOnComplete: { count: 1000, age: 24 * 3600 },
        removeOnFail: { count: 5000, age: 7 * 24 * 3600 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    };

    const mergedOptions = { ...defaultOptions, ...options };

    try {
      const queue = new Queue(queueName, mergedOptions);
      
      queue.on('error', (err) => {
        // Suppress Redis version errors to allow graceful degradation
        if (!err.message || !err.message.includes('Redis version needs to be greater')) {
          Logger.error(`❌ Queue ${queueName} error:`, err.message);
        }
      });
      
      this.queues[queueName] = queue;
      Logger.info(`✅ Queue created: ${queueName}`);
      return queue;
    } catch (error) {
      if (!error.message || !error.message.includes('Redis version needs to be greater')) {
        Logger.error(`❌ Failed to create queue ${queueName}:`, error.message);
      } else {
        Logger.warn(`⚠️ Queue ${queueName} skipped: Redis version incompatible (BullMQ requires Redis 5+)`);
      }
      return null;
    }
  }

  async addJob(queueName, jobName, data, options = {}) {
    try {
      const queue = await this.createQueue(queueName);
      if (!queue) {
        Logger.warn(`⚠️ Queue ${queueName} not available - job ${jobName} not queued`);
        return null;
      }
      const job = await queue.add(jobName, data, options);
      Logger.info(`Job added to ${queueName}: ${jobName}`, { jobId: job.id, data });
      return job;
    } catch (error) {
      Logger.error(`❌ Failed to add job to ${queueName}:`, error);
      return null;
    }
  }

  async getQueueStats(queueName) {
    try {
      const queue = this.queues[queueName];
      if (!queue) {
        return null;
      }

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      };
    } catch (error) {
      Logger.error(`❌ Failed to get stats for ${queueName}:`, error);
      return null;
    }
  }

  async closeQueue(queueName) {
    try {
      if (this.queues[queueName]) {
        await this.queues[queueName].close();
        delete this.queues[queueName];
        Logger.info(`✅ Queue closed: ${queueName}`);
      }
    } catch (error) {
      Logger.error(`❌ Failed to close queue ${queueName}:`, error);
    }
  }

  async pauseQueue(queueName) {
    try {
      const queue = this.queues[queueName];
      if (queue) {
        await queue.pause();
        Logger.info(`⏸️ Queue paused: ${queueName}`);
      }
    } catch (error) {
      Logger.error(`❌ Failed to pause queue ${queueName}:`, error);
    }
  }

  async resumeQueue(queueName) {
    try {
      const queue = this.queues[queueName];
      if (queue) {
        await queue.resume();
        Logger.info(`▶️ Queue resumed: ${queueName}`);
      }
    } catch (error) {
      Logger.error(`❌ Failed to resume queue ${queueName}:`, error);
    }
  }

  async cleanQueue(queueName, jobsToKeep = 100) {
    try {
      const queue = this.queues[queueName];
      if (queue) {
        await queue.clean(0, jobsToKeep, 'completed');
        await queue.clean(0, jobsToKeep, 'failed');
        Logger.info(`🧹 Queue cleaned: ${queueName}`);
      }
    } catch (error) {
      Logger.error(`❌ Failed to clean queue ${queueName}:`, error);
    }
  }

  async disconnect() {
    try {
      for (const queueName in this.queues) {
        await this.closeQueue(queueName);
      }

      if (this.redisClient && this.isConnected) {
        await this.redisClient.quit();
        Logger.info('📴 Queue Service Disconnected');
      }
      this.isConnected = false;
    } catch (error) {
      Logger.error('❌ Error disconnecting queue service:', error);
    }
  }

  getConnectedQueues() {
    return Object.keys(this.queues);
  }

  async isHealthy() {
    try {
      if (!this.isConnected || !this.redisClient) {
        return false;
      }

      await this.redisClient.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new QueueService();