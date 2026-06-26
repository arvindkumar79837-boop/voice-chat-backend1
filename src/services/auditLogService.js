const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const Logger = require('../utils/logger');

class AuditLogService {
  constructor() {
    this.isEnabled = process.env.AUDIT_LOGGING_ENABLED !== 'false';
    this.bufferSize = parseInt(process.env.AUDIT_BUFFER_SIZE) || 100;
    this.flushIntervalMs = parseInt(process.env.AUDIT_FLUSH_INTERVAL) || 5000;
    this.logBuffer = [];
    this.flushInterval = null;
    this.retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS) || 90;
  }

  async initialize() {
    if (!this.isEnabled) {
      Logger.info('Audit Logging Service is disabled');
      return false;
    }

    try {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, this.flushIntervalMs);

      Logger.info('Audit Logging Service initialized', {
        bufferSize: this.bufferSize,
        flushInterval: this.flushIntervalMs,
        retentionDays: this.retentionDays
      });

      return true;
    } catch (error) {
      Logger.error('Audit Logging Service initialization failed', { error: error.message });
      return false;
    }
  }

  log(action, actor, resource, details = {}, severity = 'info') {
    if (!this.isEnabled) return null;

    const logEntry = {
      action,
      actor: {
        userId: actor?.userId || null,
        username: actor?.username || 'system',
        role: actor?.role || 'system',
        ipAddress: actor?.ipAddress || null,
        userAgent: actor?.userAgent || null
      },
      resource: {
        type: resource?.type || 'unknown',
        id: resource?.id || null,
        name: resource?.name || null
      },
      details,
      severity,
      timestamp: new Date(),
      serverId: process.env.SERVER_ID || 'primary'
    };

    this.logBuffer.push(logEntry);

    if (this.logBuffer.length >= this.bufferSize) {
      this.flush();
    }

    Logger.info(`[Audit] ${action}`, {
      userId: logEntry.actor.userId,
      resourceType: logEntry.resource.type,
      severity
    });

    return logEntry;
  }

  async flush() {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await AuditLog.insertMany(entries, { ordered: false });
      Logger.info(`Flushed ${entries.length} audit log entries`);
    } catch (error) {
      Logger.error('Failed to flush audit logs', { error: error.message });
      this.logBuffer.unshift(...entries.slice(0, 20));
    }
  }

  async query(filters = {}, pagination = {}) {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    try {
      let query = AuditLog.find();

      if (filters.userId) {
        query = query.where('actor.userId').equals(filters.userId);
      }

      if (filters.action) {
        query = query.where('action').equals(filters.action);
      }

      if (filters.resourceType) {
        query = query.where('resource.type').equals(filters.resourceType);
      }

      if (filters.severity) {
        query = query.where('severity').equals(filters.severity);
      }

      if (filters.startDate && filters.endDate) {
        query = query.where('timestamp').gte(filters.startDate).lte(filters.endDate);
      }

      if (filters.search) {
        query = query.where('details').regex(filters.search, 'i');
      }

      const total = await AuditLog.countDocuments(query.getFilter());
      const logs = await query
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      Logger.error('Failed to query audit logs', { error: error.message });
      return { logs: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
  }

  async getActivityReport(durationMs = 86400000) {
    try {
      const startDate = new Date(Date.now() - durationMs);
      const pipeline = [
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: {
              userId: '$actor.userId',
              username: '$actor.username',
              role: '$actor.role'
            },
            actionCount: { $sum: 1 },
            lastAction: { $max: '$timestamp' },
            actions: { $push: '$action' },
            severities: { $push: '$severity' }
          }
        },
        { $sort: { actionCount: -1 } },
        { $limit: 100 }
      ];

      const results = await AuditLog.aggregate(pipeline);

      return results.map(item => ({
        userId: item._id.userId,
        username: item._id.username,
        role: item._id.role,
        actionCount: item.actionCount,
        lastAction: item.lastAction,
        uniqueActions: [...new Set(item.actions)],
        severityBreakdown: this.countSeverities(item.severities)
      }));
    } catch (error) {
      Logger.error('Failed to generate activity report', { error: error.message });
      return [];
    }
  }

  countSeverities(severities) {
    return severities.reduce((acc, severity) => {
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});
  }

  async getResourceAccessHistory(resourceType, resourceId, limit = 50) {
    try {
      const logs = await AuditLog.find({
        'resource.type': resourceType,
        'resource.id': resourceId
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();

      return logs;
    } catch (error) {
      Logger.error('Failed to fetch resource access history', { error: error.message });
      return [];
    }
  }

  async getSuspiciousActivity(durationMs = 3600000) {
    try {
      const startDate = new Date(Date.now() - durationMs);
      const threshold = 100;

      const pipeline = [
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: '$actor.userId',
            count: { $sum: 1 },
            actions: { $push: '$action' },
            ipAddresses: { $addToSet: '$actor.ipAddress' },
            resources: { $addToSet: '$resource.type' }
          }
        },
        { $match: { count: { $gt: threshold } } },
        { $sort: { count: -1 } }
      ];

      const suspicious = await AuditLog.aggregate(pipeline);

      return suspicious.map(item => ({
        userId: item._id,
        actionCount: item.count,
        uniqueActions: [...new Set(item.actions)],
        ipAddresses: item.ipAddresses.filter(Boolean),
        resourceTypes: item.resources.filter(Boolean),
        suspicionLevel: item.count > 500 ? 'high' : 'medium'
      }));
    } catch (error) {
      Logger.error('Failed to detect suspicious activity', { error: error.message });
      return [];
    }
  }

  async exportLogs(startDate, endDate, format = 'json') {
    try {
      const filters = { startDate, endDate };
      const result = await this.query(filters, { limit: 10000 });

      if (format === 'csv') {
        const csv = this.convertToCSV(result.logs);
        return { format: 'csv', data: csv };
      }

      return { format: 'json', data: result.logs };
    } catch (error) {
      Logger.error('Failed to export logs', { error: error.message });
      throw error;
    }
  }

  convertToCSV(logs) {
    if (!logs || logs.length === 0) return '';

    const headers = ['Timestamp', 'Action', 'UserId', 'Username', 'Role', 'ResourceType', 'ResourceId', 'Severity'];
    const rows = logs.map(log => [
      log.timestamp,
      log.action,
      log.actor.userId || '',
      log.actor.username || '',
      log.actor.role || '',
      log.resource.type || '',
      log.resource.id || '',
      log.severity || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  async cleanupOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      const result = await AuditLog.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      Logger.info('Old audit logs cleaned up', { deletedCount: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      Logger.error('Failed to cleanup old audit logs', { error: error.message });
      return 0;
    }
  }

  getStats() {
    return {
      enabled: this.isEnabled,
      bufferedEntries: this.logBuffer.length,
      flushInterval: this.flushIntervalMs,
      retentionDays: this.retentionDays
    };
  }

  stop() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
      this.flush();
      Logger.info('Audit Logging Service stopped');
    }
  }
}

module.exports = new AuditLogService();