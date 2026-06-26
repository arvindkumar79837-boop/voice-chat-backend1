const Sentry = require('@sentry/node');
const { NodeInstrumentation } = require('@sentry/integrations');
const MonitoringService = require('./monitoringService');
const Logger = require('../utils/logger');

class ErrorReportingService {
  constructor() {
    this.isEnabled = process.env.SENTRY_DSN ? true : false;
    this.dsn = process.env.SENTRY_DSN || '';
    this.environment = process.env.NODE_ENV || 'development';
    this.errorHistory = [];
    this.maxHistory = parseInt(process.env.ERROR_HISTORY_MAX) || 500;
    this.alertThresholds = {
      critical: 10,
      error: 50,
      warning: 200
    };
    this.aiResolutionEnabled = process.env.AI_ERROR_RESOLUTION === 'true';
  }

  initialize() {
    if (!this.isEnabled) {
      Logger.info('Sentry Error Reporting is disabled');
      return false;
    }

    try {
      Sentry.init({
        dsn: this.dsn,
        environment: this.environment,
        tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1,
        integrations: [
          new NodeInstrumentation(),
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express({ app: null })
        ]
      });

      const requestHandler = Sentry.Handlers.requestHandler();
      const tracingHandler = Sentry.Handlers.tracingHandler();

      Logger.info('Sentry Error Reporting initialized', { environment: this.environment });
      return true;
    } catch (error) {
      Logger.error('Sentry initialization failed', { error: error.message });
      this.isEnabled = false;
      return false;
    }
  }

  captureException(error, context = {}) {
    const errorRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      timestamp: new Date().toISOString(),
      error: {
        message: error.message || String(error),
        stack: error.stack,
        name: error.name
      },
      context,
      severity: this.determineSeverity(error),
      aiGenerated: false,
      resolved: false
    };

    if (this.isEnabled) {
      Sentry.withScope((scope) => {
        scope.setContext('custom', context);
        scope.setLevel(errorRecord.severity);
        Sentry.captureException(error);
      });
    }

    this.errorHistory.unshift(errorRecord);
    if (this.errorHistory.length > this.maxHistory) {
      this.errorHistory.pop();
    }

    this.checkAlertThresholds(errorRecord.severity);

    Logger.error('Error captured', {
      id: errorRecord.id,
      message: errorRecord.error.message,
      severity: errorRecord.severity
    });

    return errorRecord;
  }

  captureMessage(message, level = 'info', context = {}) {
    const messageRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      timestamp: new Date().toISOString(),
      message,
      level,
      context,
      severity: this.mapLevelToSeverity(level)
    };

    if (this.isEnabled) {
      Sentry.captureMessage(message, level);
    }

    this.errorHistory.unshift(messageRecord);
    if (this.errorHistory.length > this.maxHistory) {
      this.errorHistory.pop();
    }

    return messageRecord;
  }

  determineSeverity(error) {
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
      return 'warning';
    }
    if (error.message?.includes('MongoServerError') || error.message?.includes('MongoNetworkError')) {
      return 'critical';
    }
    if (error.statusCode >= 500) {
      return 'error';
    }
    if (error.statusCode >= 400) {
      return 'warning';
    }
    return 'error';
  }

  mapLevelToSeverity(level) {
    const mapping = {
      fatal: 'critical',
      error: 'error',
      warning: 'warning',
      info: 'info',
      log: 'info',
      debug: 'info'
    };
    return mapping[level] || 'info';
  }

  checkAlertThresholds(severity) {
    const recentErrors = this.getRecentErrors(5 * 60 * 1000);
    const countBySeverity = recentErrors.reduce((acc, err) => {
      acc[err.severity] = (acc[err.severity] || 0) + 1;
      return acc;
    }, {});

    for (const [level, threshold] of Object.entries(this.alertThresholds)) {
      if (countBySeverity[level] >= threshold) {
        this.triggerAlert(level, countBySeverity[level]);
      }
    }
  }

  triggerAlert(severity, count) {
    const alert = {
      timestamp: new Date().toISOString(),
      severity,
      count,
      message: `High volume of ${severity} errors detected: ${count} in last 5 minutes`
    };

    Logger.error('ALERT TRIGGERED', alert);

    if (global.io) {
      global.io.to('admins').emit('error:alert', alert);
    }

    if (process.env.ALERT_EMAIL_ENABLED === 'true') {
      this.sendEmailAlert(alert);
    }

    if (process.env.ALERT_SLACK_WEBHOOK) {
      this.sendSlackAlert(alert);
    }
  }

  async sendEmailAlert(alert) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.ALERT_FROM_EMAIL,
        to: process.env.ALERT_TO_EMAIL,
        subject: `[${alert.severity.toUpperCase()}] Arvind Party - Critical Error Alert`,
        html: `
          <h2>Critical Error Alert</h2>
          <p><strong>Severity:</strong> ${alert.severity}</p>
          <p><strong>Count:</strong> ${alert.count}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Time:</strong> ${alert.timestamp}</p>
        `
      });

      Logger.info('Email alert sent', { severity: alert.severity, count: alert.count });
    } catch (error) {
      Logger.error('Failed to send email alert', { error: error.message });
    }
  }

  async sendSlackAlert(alert) {
    try {
      const axios = require('axios');
      await axios.post(process.env.ALERT_SLACK_WEBHOOK, {
        text: `*[${alert.severity.toUpperCase()}]* Arvind Party Alert\n${alert.message}\nTime: ${alert.timestamp}`,
        attachments: [{
          color: alert.severity === 'critical' ? 'danger' : alert.severity === 'error' ? 'warning' : 'good',
          fields: [
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Count', value: alert.count.toString(), short: true },
            { title: 'Time', value: alert.timestamp, short: false }
          ]
        }]
      });

      Logger.info('Slack alert sent', { severity: alert.severity });
    } catch (error) {
      Logger.error('Failed to send Slack alert', { error: error.message });
    }
  }

  async generateAIResolution(errorId) {
    if (!this.aiResolutionEnabled) {
      return null;
    }

    const error = this.errorHistory.find(e => e.id === errorId);
    if (!error) {
      return null;
    }

    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `
You are a senior Node.js developer. Analyze this error and provide a detailed solution.

Error: ${error.error.message}
Stack: ${error.error.stack}
Context: ${JSON.stringify(error.context, null, 2)}

Provide:
1. Root cause analysis
2. Step-by-step solution
3. Prevention strategy
4. Code fix if applicable
      `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      });

      const aiSolution = completion.choices[0].message.content;

      error.aiGenerated = true;
      error.aiSolution = aiSolution;
      error.aiResolvedAt = new Date().toISOString();

      if (global.io) {
        global.io.to('admins').emit('error:ai_solution', {
          errorId: error.id,
          solution: aiSolution
        });
      }

      Logger.info('AI resolution generated', { errorId });
      return aiSolution;
    } catch (error) {
      Logger.error('AI resolution failed', { errorId, error: error.message });
      return null;
    }
  }

  getRecentErrors(durationMs = 3600000) {
    const cutoff = Date.now() - durationMs;
    return this.errorHistory.filter(err => new Date(err.timestamp).getTime() > cutoff);
  }

  getErrorStats() {
    const recent = this.getRecentErrors(3600000);
    const stats = {
      total: recent.length,
      bySeverity: {},
      byHour: {},
      topErrors: []
    };

    const errorCounts = {};
    recent.forEach(err => {
      stats.bySeverity[err.severity] = (stats.bySeverity[err.severity] || 0) + 1;

      const hour = new Date(err.timestamp).toISOString().slice(0, 13);
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

      const key = err.error.message;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    stats.topErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return stats;
  }

  getErrorHistory(limit = 100, severity = null) {
    let errors = this.errorHistory.slice(0, limit);
    if (severity) {
      errors = errors.filter(e => e.severity === severity);
    }
    return errors;
  }

  clearHistory() {
    this.errorHistory = [];
    Logger.info('Error history cleared');
  }

  getHealthStatus() {
    const recentErrors = this.getRecentErrors(300000);
    const criticalCount = recentErrors.filter(e => e.severity === 'critical').length;

    let status = 'healthy';
    if (criticalCount > 5) status = 'critical';
    else if (recentErrors.length > 50) status = 'degraded';

    return {
      status,
      enabled: this.isEnabled,
      recentErrors: recentErrors.length,
      criticalCount,
      dsn: this.dsn ? '[CONFIGURED]' : 'NOT CONFIGURED'
    };
  }

  resolveError(errorId, resolution) {
    const error = this.errorHistory.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      error.resolution = resolution;
      error.resolvedAt = new Date().toISOString();
      Logger.info('Error marked as resolved', { errorId, resolution });
      return true;
    }
    return false;
  }

  getSentryUser(userId) {
    if (!this.isEnabled) return null;

    return Sentry.getUser();
  }

  setSentryUser(user) {
    if (!this.isEnabled) return;

    Sentry.setUser(user);
  }
}

module.exports = new ErrorReportingService();