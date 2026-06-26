const Queue = require('bullmq');
const Redis = require('redis');
const Logger = require('../utils/logger');

class QueueService {
  constructor() {
    this.redisClient = null;
    this.queues = {};
    this.isConnected = false;
  }

  async connect() {
    try {
      this.redisClient = new Redis.RedisClient({
        socket: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB || '0')
      });

      this.redisClient.on('error', (err) => {
        console.error('❌ Queue Redis Error:', err.message);
        this.isConnected = false;
      });

      this.redisClient.on('connect', () => {
        console.log('🔄 Queue Redis Client Connected');
      });

      this.redisClient.on('ready', () => {
        console.log('✅ Queue Redis Client Ready');
        this.isConnected = true;
      });

      await this.redisClient.connect();
      this.isConnected = true;
      console.log('✅ Queue Service Connected');
      return true;
    } catch (error) {
      console.error('⚠️ Queue Service Connection Failed:', error.message);
      return false;
    }
  }

  getRedisClient() {
    return this.redisClient;
  }

  getQueueConnection() {
    return {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '0')
    };
  }

  async createQueue(queueName, options = {}) {
    if (!this.isConnected) {
      throw new Error('Queue service not connected');
    }

    if (this.queues[queueName]) {
      return this.queues[queueName];
    }

    const defaultOptions = {
      connection: this.getQueueConnection(),
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
      this.queues[queueName] = queue;
      console.log(`✅ Queue created: ${queueName}`);
      return queue;
    } catch (error) {
      console.error(`❌ Failed to create queue ${queueName}:`, error);
      throw error;
    }
  }

  async addJob(queueName, jobName, data, options = {}) {
    try {
      const queue = await this.createQueue(queueName);
      const job = await queue.add(jobName, data, options);
      Logger.info(`Job added to ${queueName}: ${jobName}`, { jobId: job.id, data });
      return job;
    } catch (error) {
      console.error(`❌ Failed to add job to ${queueName}:`, error);
      throw error;
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
      console.error(`❌ Failed to get stats for ${queueName}:`, error);
      return null;
    }
  }

  async closeQueue(queueName) {
    try {
      if (this.queues[queueName]) {
        await this.queues[queueName].close();
        delete this.queues[queueName];
        console.log(`✅ Queue closed: ${queueName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to close queue ${queueName}:`, error);
    }
  }

  async pauseQueue(queueName) {
    try {
      const queue = this.queues[queueName];
      if (queue) {
        await queue.pause();
        console.log(`⏸️ Queue paused: ${queueName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to pause queue ${queueName}:`, error);
    }
  }

  async resumeQueue(queueName) {
    try {
      const queue = this.queues[queueName];
      if (queue) {
        await queue.resume();
        console.log(`▶️ Queue resumed: ${queueName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to resume queue ${queueName}:`, error);
    }
  }

  async cleanQueue(queueName, jobsToKeep = 100) {
    try {
      const queue = this.queues[queueName];
      if (queue) {
        await queue.clean(0, jobsToKeep, 'completed');
        await queue.clean(0, jobsToKeep, 'failed');
        console.log(`🧹 Queue cleaned: ${queueName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to clean queue ${queueName}:`, error);
    }
  }

  async disconnect() {
    try {
      for (const queueName in this.queues) {
        await this.closeQueue(queueName);
      }

      if (this.redisClient && this.isConnected) {
        await this.redisClient.quit();
        console.log('📴 Queue Service Disconnected');
      }
      this.isConnected = false;
    } catch (error) {
      console.error('❌ Error disconnecting queue service:', error);
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