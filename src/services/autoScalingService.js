const os = require('os');
const MonitoringService = require('./monitoringService');
const Logger = require('../utils/logger');

class AutoScalingService {
  constructor() {
    this.isEnabled = process.env.AUTO_SCALING_ENABLED === 'true';
    this.checkInterval = null;
    this.scalingHistory = [];
    this.currentInstanceCount = 1;
    this.minInstances = parseInt(process.env.MIN_INSTANCES) || 1;
    this.maxInstances = parseInt(process.env.MAX_INSTANCES) || 4;
    this.cpuThreshold = parseFloat(process.env.CPU_SCALE_THRESHOLD) || 75;
    this.memoryThreshold = parseFloat(process.env.MEMORY_SCALE_THRESHOLD) || 80;
    this.cooldownPeriod = parseInt(process.env.SCALE_COOLDOWN_MS) || 300000;
    this.lastScaleAction = 0;
    this.scaleUpCount = 0;
    this.scaleDownCount = 0;
  }

  start() {
    if (!this.isEnabled) {
      Logger.info('Auto Scaling is disabled');
      return;
    }

    Logger.info('🚀 Auto Scaling Service started', {
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      cpuThreshold: this.cpuThreshold,
      memoryThreshold: this.memoryThreshold
    });

    this.checkInterval = setInterval(() => {
      this.evaluateScaling();
    }, 30000);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      Logger.info('Auto Scaling Service stopped');
    }
  }

  evaluateScaling() {
    const metrics = MonitoringService.getMetrics();
    const system = metrics.system;
    const cpuUsage = system.cpu?.usage || 0;
    const memoryUsage = system.memory?.percentage || 0;
    const activeConnections = metrics.sockets?.connected || 0;
    const queueDepth = (metrics.queue?.jobs?.waiting || 0) + (metrics.queue?.jobs?.active || 0);

    this.recordMetricsSnapshot(cpuUsage, memoryUsage, activeConnections, queueDepth);

    if (Date.now() - this.lastScaleAction < this.cooldownPeriod) {
      return;
    }

    const shouldScaleUp = this.shouldScaleUp(cpuUsage, memoryUsage, queueDepth);
    const shouldScaleDown = this.shouldScaleDown(cpuUsage, memoryUsage, activeConnections);

    if (shouldScaleUp && this.currentInstanceCount < this.maxInstances) {
      this.scaleUp();
    } else if (shouldScaleDown && this.currentInstanceCount > this.minInstances) {
      this.scaleDown();
    }
  }

  shouldScaleUp(cpuUsage, memoryUsage, queueDepth) {
    const highCpu = cpuUsage > this.cpuThreshold;
    const highMemory = memoryUsage > this.memoryThreshold;
    const highQueueDepth = queueDepth > 1000;
    const consecutiveHigh = this.checkConsecutiveHighMetrics(3);

    return (highCpu && highMemory) || highQueueDepth || (consecutiveHigh && (highCpu || highMemory));
  }

  shouldScaleDown(cpuUsage, memoryUsage, activeConnections) {
    const lowCpu = cpuUsage < 25;
    const lowMemory = memoryUsage < 30;
    const lowConnections = activeConnections < 50;
    const consecutiveLow = this.checkConsecutiveLowMetrics(5);

    return lowCpu && lowMemory && lowConnections && consecutiveLow;
  }

  checkConsecutiveHighMetrics(requiredCount) {
    const recentSnapshots = this.scalingHistory.slice(-requiredCount);
    if (recentSnapshots.length < requiredCount) return false;

    return recentSnapshots.every(snapshot =>
      snapshot.cpu > this.cpuThreshold || snapshot.memory > this.memoryThreshold
    );
  }

  checkConsecutiveLowMetrics(requiredCount) {
    const recentSnapshots = this.scalingHistory.slice(-requiredCount);
    if (recentSnapshots.length < requiredCount) return false;

    return recentSnapshots.every(snapshot =>
      snapshot.cpu < 30 && snapshot.memory < 40 && snapshot.connections < 100
    );
  }

  recordMetricsSnapshot(cpu, memory, connections, queue) {
    this.scalingHistory.push({
      timestamp: Date.now(),
      cpu,
      memory,
      connections,
      queue
    });

    if (this.scalingHistory.length > 60) {
      this.scalingHistory.shift();
    }
  }

  async scaleUp() {
    const newInstanceCount = Math.min(this.currentInstanceCount + 1, this.maxInstances);
    this.lastScaleAction = Date.now();
    this.currentInstanceCount = newInstanceCount;
    this.scaleUpCount++;

    Logger.warn('⬆️ Scaling UP triggered', {
      from: this.currentInstanceCount - 1,
      to: newInstanceCount,
      reason: this.getScaleReason()
    });

    try {
      if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        await this.triggerAWSLambdaScale(newInstanceCount);
      } else if (process.env.RENDER_SERVICE_ID) {
        await this.triggerRenderScale(newInstanceCount);
      } else if (process.env.DOCKER_SWARM_MODE === 'true') {
        await this.triggerDockerSwarmScale(newInstanceCount);
      } else {
        await this.triggerGenericScale(newInstanceCount);
      }

      this.emitScalingEvent('scale_up', newInstanceCount);
    } catch (error) {
      Logger.error('Scale up failed', { error: error.message });
      this.currentInstanceCount--;
      this.scaleUpCount--;
    }
  }

  async scaleDown() {
    const newInstanceCount = Math.max(this.currentInstanceCount - 1, this.minInstances);
    this.lastScaleAction = Date.now();
    this.currentInstanceCount = newInstanceCount;
    this.scaleDownCount++;

    Logger.warn('⬇️ Scaling DOWN triggered', {
      from: this.currentInstanceCount + 1,
      to: newInstanceCount,
      reason: 'Low traffic detected'
    });

    try {
      if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        await this.triggerAWSLambdaScale(newInstanceCount);
      } else if (process.env.RENDER_SERVICE_ID) {
        await this.triggerRenderScale(newInstanceCount);
      } else if (process.env.DOCKER_SWARM_MODE === 'true') {
        await this.triggerDockerSwarmScale(newInstanceCount);
      } else {
        await this.triggerGenericScale(newInstanceCount);
      }

      this.emitScalingEvent('scale_down', newInstanceCount);
    } catch (error) {
      Logger.error('Scale down failed', { error: error.message });
      this.currentInstanceCount++;
      this.scaleDownCount--;
    }
  }

  getScaleReason() {
    const metrics = MonitoringService.getMetrics();
    const reasons = [];

    if (metrics.system.cpu?.usage > this.cpuThreshold) {
      reasons.push(`CPU at ${metrics.system.cpu.usage.toFixed(1)}%`);
    }
    if (metrics.system.memory?.percentage > this.memoryThreshold) {
      reasons.push(`Memory at ${metrics.system.memory.percentage.toFixed(1)}%`);
    }
    if ((metrics.queue?.jobs?.waiting || 0) > 1000) {
      reasons.push('High queue backlog');
    }

    return reasons.join(', ');
  }

  async triggerAWSLambdaScale(instanceCount) {
    const AWS = require('aws-sdk');
    const autoscaling = new AWS.AutoScaling({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });

    const params = {
      AutoScalingGroupName: process.env.AWS_AUTOSCALING_GROUP,
      DesiredCapacity: instanceCount,
      MinSize: this.minInstances,
      MaxSize: this.maxInstances
    };

    await autoscaling.updateAutoScalingGroup(params).promise();
    Logger.info('AWS AutoScaling group updated', { instanceCount });
  }

  async triggerRenderScale(instanceCount) {
    const render = require('render-api-client');
    await render.updateService({
      serviceId: process.env.RENDER_SERVICE_ID,
      plan: instanceCount > 1 ? 'starter' : 'free'
    });
    Logger.info('Render service scaled', { instanceCount });
  }

  async triggerDockerSwarmScale(instanceCount) {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    await execAsync(`docker service scale arvind-party-backend=${instanceCount}`);
    Logger.info('Docker Swarm service scaled', { instanceCount });
  }

  async triggerGenericScale(instanceCount) {
    Logger.info('Generic scale request', { instanceCount });
    if (this.onScaleCallback) {
      await this.onScaleCallback(instanceCount);
    }
  }

  emitScalingEvent(action, instanceCount) {
    if (this.io) {
      this.io.to('admins').emit('scaling:event', {
        action,
        instanceCount,
        timestamp: new Date().toISOString(),
        metrics: MonitoringService.getMetrics()
      });
    }
  }

  getScalingStats() {
    return {
      isEnabled: this.isEnabled,
      currentInstanceCount: this.currentInstanceCount,
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      scaleUpCount: this.scaleUpCount,
      scaleDownCount: this.scaleDownCount,
      lastScaleAction: this.lastScaleAction ? new Date(this.lastScaleAction).toISOString() : null,
      cpuThreshold: this.cpuThreshold,
      memoryThreshold: this.memoryThreshold,
      cooldownPeriod: this.cooldownPeriod,
      recentHistory: this.scalingHistory.slice(-10)
    };
  }

  manualScale(direction) {
    if (direction === 'up' && this.currentInstanceCount < this.maxInstances) {
      this.scaleUp();
    } else if (direction === 'down' && this.currentInstanceCount > this.minInstances) {
      this.scaleDown();
    } else {
      Logger.warn('Manual scale blocked', { direction, current: this.currentInstanceCount });
    }
  }

  setIo(io) {
    this.io = io;
  }

  setScaleCallback(callback) {
    this.onScaleCallback = callback;
  }
}

module.exports = new AutoScalingService();