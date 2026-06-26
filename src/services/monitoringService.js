const os = require('os');
const { EventEmitter } = require('events');

class MonitoringService extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      requests: { total: 0, success: 0, failed: 0 },
      latency: { avg: 0, samples: [] },
      connections: { active: 0, total: 0 },
      system: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        loadAverage: [0, 0, 0]
      },
      database: {
        connected: false,
        operations: { read: 0, write: 0, failed: 0 }
      },
      redis: {
        connected: false,
        hitRate: 0,
        operations: { get: 0, set: 0, del: 0 }
      },
      sockets: { connected: 0, rooms: 0, messages: 0 },
      queue: { jobs: { waiting: 0, active: 0, completed: 0, failed: 0 } }
    };
    this.startTime = Date.now();
    this.collectionInterval = null;
  }

  startCollection(intervalMs = 5000) {
    this.collectMetrics();
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
    console.log('📊 [MonitoringService] Started');
  }

  stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  collectMetrics() {
    const cpuUsage = this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();

    this.metrics.system = {
      cpu: cpuUsage,
      memory: memoryUsage.percentage,
      uptime: process.uptime(),
      loadAverage: os.loadavg(),
      totalMemory: memoryUsage.total,
      usedMemory: memoryUsage.used,
      freeMemory: memoryUsage.free
    };

    this.emit('metrics:update', this.metrics);
  }

  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    return {
      cores: cpus.length,
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length,
      usage: ((totalTick - totalIdle) / totalTick) * 100
    };
  }

  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      total: Math.round(totalMem / 1024 / 1024),
      free: Math.round(freeMem / 1024 / 1024),
      used: Math.round(usedMem / 1024 / 1024),
      percentage: parseFloat(((usedMem / totalMem) * 100).toFixed(2))
    };
  }

  recordRequest(status, latencyMs) {
    this.metrics.requests.total++;
    if (status >= 200 && status < 300) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.failed++;
    }

    this.metrics.latency.samples.push(latencyMs);
    if (this.metrics.latency.samples.length > 1000) {
      this.metrics.latency.samples.shift();
    }

    const sum = this.metrics.latency.samples.reduce((a, b) => a + b, 0);
    this.metrics.latency.avg = parseFloat((sum / this.metrics.latency.samples.length).toFixed(2));
  }

  updateDatabaseStatus(connected) {
    this.metrics.database.connected = connected;
  }

  updateRedisStatus(connected) {
    this.metrics.redis.connected = connected;
  }

  updateSocketMetrics(connected, rooms, messages) {
    this.metrics.sockets.connected = connected;
    this.metrics.sockets.rooms = rooms;
    this.metrics.sockets.messages = messages;
  }

  updateQueueStats(stats) {
    if (stats) {
      this.metrics.queue.jobs = stats;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      serverTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };
  }

  getHealthStatus() {
    const system = this.metrics.system;
    const database = this.metrics.database;
    const redis = this.metrics.redis;

    const issues = [];
    if (system.memory > 85) {
      issues.push('High memory usage detected');
    }
    if (system.cpu && system.cpu.usage > 80) {
      issues.push('High CPU usage detected');
    }
    if (!database.connected) {
      issues.push('Database connection lost');
    }
    if (!redis.connected) {
      issues.push('Redis connection lost');
    }

    const isHealthy = issues.length === 0;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      uptime: system.uptime,
      issues,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new MonitoringService();