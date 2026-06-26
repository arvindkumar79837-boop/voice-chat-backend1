const MonitoringService = require('./monitoringService');
const AutoScalingService = require('./autoScalingService');
const BackupService = require('./backupService');
const Logger = require('../utils/logger');

class HealthAlertService {
  constructor() {
    this.isEnabled = process.env.HEALTH_ALERTS_ENABLED !== 'false';
    this.checkIntervalMs = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000;
    this.alertCooldownMs = parseInt(process.env.ALERT_COOLDOWN_MS) || 300000;
    this.lastAlertTime = {};
    this.alertHistory = [];
    this.maxHistory = 100;
    this.checkInterval = null;
    this.activeAlerts = [];
    this.alertRules = {
      memory: { threshold: 85, severity: 'critical', cooldown: 300000 },
      cpu: { threshold: 90, severity: 'error', cooldown: 300000 },
      diskSpace: { threshold: 90, severity: 'critical', cooldown: 600000 },
      database: { severity: 'critical', cooldown: 180000 },
      redis: { severity: 'warning', cooldown: 180000 },
      queue: { severity: 'warning', cooldown: 180000 },
      websocket: { severity: 'warning', cooldown: 180000 },
      backup: { severity: 'warning', cooldown: 21600000 },
      errorRate: { threshold: 20, severity: 'error', cooldown: 300000 }
    };
  }

  start() {
    if (!this.isEnabled) {
      Logger.info('Health Alert Service is disabled');
      return;
    }

    Logger.info('Health Alert Service started', { interval: this.checkIntervalMs });

    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, this.checkIntervalMs);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      Logger.info('Health Alert Service stopped');
    }
  }

  async runHealthChecks() {
    try {
      const metrics = MonitoringService.getMetrics();
      const system = metrics.system;
      const health = MonitoringService.getHealthStatus();

      if (health.status === 'healthy') {
        this.resolveAllAlerts();
        return;
      }

      if (system.memory > this.alertRules.memory.threshold) {
        this.triggerAlert('memory', 'high', `Memory usage critical: ${system.memory}%`, {
          memory: system.memory,
          total: system.totalMemory,
          used: system.usedMemory,
          free: system.freeMemory
        }, this.alertRules.memory.severity);
      }

      if (system.cpu?.usage > this.alertRules.cpu.threshold) {
        this.triggerAlert('cpu', 'high', `CPU usage critical: ${system.cpu.usage.toFixed(1)}%`, {
          cpu: system.cpu.usage,
          cores: system.cpu.cores
        }, this.alertRules.cpu.severity);
      }

      if (!metrics.database?.connected) {
        this.triggerAlert('database', 'down', 'Database connection lost', {
          status: 'disconnected'
        }, this.alertRules.database.severity);
      }

      if (!metrics.redis?.connected) {
        this.triggerAlert('redis', 'down', 'Redis connection lost', {
          status: 'disconnected'
        }, this.alertRules.redis.severity);
      }

      const queueJobs = metrics.queue?.jobs || {};
      const pendingJobs = queueJobs.waiting || 0;
      const failedJobs = queueJobs.failed || 0;

      if (pendingJobs > 1000 || failedJobs > 100) {
        this.triggerAlert('queue', 'degraded', `Queue backlog: ${pendingJobs} waiting, ${failedJobs} failed`, {
          waiting: pendingJobs,
          failed: failedJobs,
          active: queueJobs.active || 0
        }, this.alertRules.queue.severity);
      }

      if (metrics.database?.operations?.failed > 10) {
        this.triggerAlert('database_errors', 'high', `Database operations failing: ${metrics.database.operations.failed}`, {
          failed: metrics.database.operations.failed,
          read: metrics.database.operations.read,
          write: metrics.database.operations.write
        }, 'error');
      }

      const totalRequests = metrics.requests?.total || 0;
      const failedRequests = metrics.requests?.failed || 0;
      const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

      if (errorRate > this.alertRules.errorRate.threshold && totalRequests > 100) {
        this.triggerAlert('error_rate', 'high', `Error rate critical: ${errorRate.toFixed(1)}%`, {
          errorRate: errorRate.toFixed(1),
          totalRequests,
          failedRequests
        }, this.alertRules.errorRate.severity);
      }

      const backupStats = BackupService.getBackupStats();
      if (backupStats.lastBackup) {
        const lastBackupTime = new Date(backupStats.lastBackup);
        const hoursSinceBackup = (Date.now() - lastBackupTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceBackup > 24) {
          this.triggerAlert('backup', 'stale', `Last backup was ${Math.floor(hoursSinceBackup)} hours ago`, {
            lastBackup: backupStats.lastBackup,
            hoursSinceBackup: Math.floor(hoursSinceBackup)
          }, this.alertRules.backup.severity);
        }
      }

      if (health.issues && health.issues.length > 0) {
        health.issues.forEach(issue => {
          this.triggerAlert('general', 'warning', issue, {}, 'warning');
        });
      }
    } catch (error) {
      Logger.error('Health check error', { error: error.message });
    }
  }

  canAlert(alertType) {
    const now = Date.now();
    const lastAlert = this.lastAlertTime[alertType];
    const cooldown = this.alertRules[alertType]?.cooldown || this.alertCooldownMs;

    if (!lastAlert || now - lastAlert > cooldown) {
      this.lastAlertTime[alertType] = now;
      return true;
    }

    return false;
  }

  triggerAlert(type, subtype, message, data, severity) {
    if (!this.canAlert(`${type}_${subtype}`)) return;

    const alert = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      type,
      subtype,
      severity,
      message,
      data,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory.pop();
    }

    this.activeAlerts.push(alert);

    Logger.error('🚨 ALERT', alert);

    if (global.io) {
      global.io.to('admins').emit('health:alert', alert);
    }

    if (process.env.ALERT_EMAIL_ENABLED === 'true') {
      this.sendAlertNotification(alert);
    }

    if (process.env.ALERT_SLACK_WEBHOOK) {
      this.sendSlackAlert(alert);
    }

    if (severity === 'critical') {
      this.triggerEmergencyResponse(alert);
    }

    return alert;
  }

  async triggerEmergencyResponse(alert) {
    try {
      Logger.warn('Triggering emergency response for critical alert', { alert });

      if (alert.type === 'memory' || alert.type === 'cpu') {
        const scaleStats = AutoScalingService.getScalingStats();
        if (scaleStats.currentInstanceCount < scaleStats.maxInstances) {
          AutoScalingService.manualScale('up');
        }
      }

      if (alert.type === 'database') {
        if (BackupService.getBackupStats().lastBackup) {
          Logger.warn('Consider manual backup before any recovery action');
        }
      }
    } catch (error) {
      Logger.error('Emergency response failed', { error: error.message });
    }
  }

  async sendAlertNotification(alert) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const severityEmoji = {
        critical: '🔴',
        error: '🟠',
        warning: '🟡',
        info: '🔵'
      };

      await transporter.sendMail({
        from: process.env.ALERT_FROM_EMAIL,
        to: process.env.ALERT_TO_EMAIL,
        subject: `[${severityEmoji[alert.severity] || '⚪'}] ${alert.severity.toUpperCase()} Alert - Arvind Party`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${this.getSeverityColor(alert.severity)};">${severityEmoji[alert.severity] || '⚪'} ${alert.severity.toUpperCase()} Alert</h2>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Type:</strong> ${alert.type}</p>
              <p><strong>Subtype:</strong> ${alert.subtype}</p>
              <p><strong>Message:</strong> ${alert.message}</p>
              <p><strong>Time:</strong> ${alert.timestamp}</p>
              ${Object.keys(alert.data).length > 0 ? '<p><strong>Details:</strong></p><pre>' + JSON.stringify(alert.data, null, 2) + '</pre>' : ''}
            </div>
            <p><small>Server: ${process.env.SERVER_ID || 'primary'}</small></p>
          </div>
        `
      });

      Logger.info('Alert email sent', { alertId: alert.id });
    } catch (error) {
      Logger.error('Failed to send alert email', { alertId: alert.id, error: error.message });
    }
  }

  async sendSlackAlert(alert) {
    try {
      const axios = require('axios');
      const severityEmoji = {
        critical: ':red_circle:',
        error: ':large_orange_circle:',
        warning: ':yellow_circle:',
        info: ':large_blue_circle:'
      };

      await axios.post(process.env.ALERT_SLACK_WEBHOOK, {
        text: `${severityEmoji[alert.severity] || ':white_circle:'} *${alert.severity.toUpperCase()} Alert*`,
        attachments: [{
          color: this.getSeverityColor(alert.severity),
          fields: [
            { title: 'Type', value: alert.type, short: true },
            { title: 'Subtype', value: alert.subtype, short: true },
            { title: 'Message', value: alert.message, short: false },
            { title: 'Time', value: alert.timestamp, short: true },
            { title: 'Server', value: process.env.SERVER_ID || 'primary', short: true }
          ]
        }]
      });

      Logger.info('Slack alert sent', { alertId: alert.id });
    } catch (error) {
      Logger.error('Failed to send Slack alert', { alertId: alert.id, error: error.message });
    }
  }

  getSeverityColor(severity) {
    const colors = {
      critical: '#FF0000',
      error: '#FF6B6B',
      warning: '#FFA500',
      info: '#4A90E2'
    };
    return colors[severity] || '#808080';
  }

  acknowledgeAlert(alertId) {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      Logger.info('Alert acknowledged', { alertId });
      return true;
    }
    return false;
  }

  resolveAlert(alertId) {
    const index = this.activeAlerts.findIndex(a => a.id === alertId);
    if (index !== -1) {
      const alert = this.activeAlerts[index];
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      this.activeAlerts.splice(index, 1);

      if (global.io) {
        global.io.to('admins').emit('health:alert_resolved', {
          alertId,
          timestamp: alert.resolvedAt
        });
      }

      Logger.info('Alert resolved', { alertId });
      return true;
    }
    return false;
  }

  resolveAllAlerts() {
    this.activeAlerts = [];
  }

  getActiveAlerts() {
    return {
      count: this.activeAlerts.length,
      alerts: this.activeAlerts.slice(0, 50)
    };
  }

  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(0, limit);
  }

  getAlertStats() {
    const last24Hours = this.alertHistory.filter(
      a => Date.now() - new Date(a.timestamp).getTime() < 86400000
    );

    const bySeverity = last24Hours.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});

    const byType = last24Hours.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {});

    return {
      enabled: this.isEnabled,
      last24Hours: last24Hours.length,
      activeAlerts: this.activeAlerts.length,
      bySeverity,
      byType
    };
  }

  initialize() {
    this.start();
  }

  getHealthStatus() {
    const activeCritical = this.activeAlerts.filter(a => a.severity === 'critical').length;
    const activeErrors = this.activeAlerts.filter(a => a.severity === 'error').length;

    let status = 'healthy';
    if (activeCritical > 0) status = 'critical';
    else if (activeErrors > 2) status = 'degraded';
    else if (this.activeAlerts.length > 0) status = 'warning';

    return {
      status,
      activeAlerts: this.activeAlerts.length,
      criticalAlerts: activeCritical,
      errorAlerts: activeErrors
    };
  }
}

module.exports = new HealthAlertService();