const express = require('express');
const router = express.Router();
const AutoScalingService = require('../services/autoScalingService');
const CDNService = require('../services/cdnService');
const BackupService = require('../services/backupService');
const ErrorReportingService = require('../services/errorReportingService');
const AuditLogService = require('../services/auditLogService');
const HealthAlertService = require('../services/healthAlertService');
const DeploymentService = require('../services/deploymentService');
const FeatureFlagService = require('../services/featureFlagService');
const MonitoringService = require('../services/monitoringService');
const { isAdmin } = require('../middlewares/isAdmin');
const { normalizeReq } = require('../utils/requestParser');

router.use(isAdmin);

router.get('/metrics', (req, res) => {
  try {
    const metrics = MonitoringService.getMetrics();
    const health = MonitoringService.getHealthStatus();
    res.json({ success: true, data: { metrics, health } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch metrics', error: error.message });
  }
});

router.get('/monitoring/health', (req, res) => {
  try {
    const services = {
      monitoring: MonitoringService.getHealthStatus(),
      cdn: CDNService.getHealthStatus(),
      backup: BackupService.getBackupStats(),
      errorReporting: ErrorReportingService.getHealthStatus(),
      auditLog: AuditLogService.getStats(),
      healthAlerts: HealthAlertService.getHealthStatus(),
      deployment: DeploymentService.getHealthStatus(),
      featureFlags: FeatureFlagService.getHealthStatus()
    };

    const overallStatus = Object.values(services).every(s => s.status === 'healthy' || s.status === 'disabled' || !s.status)
      ? 'healthy'
      : 'degraded';

    res.json({ success: true, data: { status: overallStatus, services } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch health status', error: error.message });
  }
});

router.get('/scaling/stats', (req, res) => {
  try {
    const stats = AutoScalingService.getScalingStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch scaling stats', error: error.message });
  }
});

router.post('/scaling/manual', (req, res) => {
  try {
    const { direction } = req.body;
    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ success: false, message: 'Invalid direction. Use up or down' });
    }
    AutoScalingService.manualScale(direction);
    res.json({ success: true, message: `Manual scale ${direction} triggered` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Manual scale failed', error: error.message });
  }
});

router.post('/cdn/upload', async (req, res) => {
  try {
    const { file, options } = req.body;
    const result = await CDNService.uploadAsset(file, options);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'CDN upload failed', error: error.message });
  }
});

router.delete('/cdn/asset/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    const { resourceType } = req.query;
    const result = await CDNService.deleteAsset(publicId, resourceType || 'image');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'CDN delete failed', error: error.message });
  }
});

router.get('/cdn/stats', (req, res) => {
  try {
    const stats = CDNService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch CDN stats', error: error.message });
  }
});

router.get('/backup/history', (req, res) => {
  try {
    const history = BackupService.getBackupHistory();
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch backup history', error: error.message });
  }
});

router.post('/backup/create', async (req, res) => {
  try {
    const result = await BackupService.createBackup();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Backup creation failed', error: error.message });
  }
});

router.post('/backup/restore/:backupId', async (req, res) => {
  try {
    const { backupId } = req.params;
    const result = await BackupService.restoreBackup(backupId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Backup restore failed', error: error.message });
  }
});

router.get('/errors/recent', (req, res) => {
  try {
    const { duration } = req.query;
    const durationMs = duration ? parseInt(duration) : 3600000;
    const errors = ErrorReportingService.getRecentErrors(durationMs);
    res.json({ success: true, data: errors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch errors', error: error.message });
  }
});

router.get('/errors/stats', (req, res) => {
  try {
    const stats = ErrorReportingService.getErrorStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch error stats', error: error.message });
  }
});

router.post('/errors/:errorId/ai-resolution', async (req, res) => {
  try {
    const { errorId } = req.params;
    const solution = await ErrorReportingService.generateAIResolution(errorId);
    res.json({ success: true, data: { solution } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'AI resolution failed', error: error.message });
  }
});

router.post('/errors/:errorId/resolve', (req, res) => {
  try {
    const { errorId } = req.params;
    const { resolution } = req.body;
    const success = ErrorReportingService.resolveError(errorId, resolution);
    res.json({ success, message: success ? 'Error resolved' : 'Error not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to resolve error', error: error.message });
  }
});

router.get('/audit/logs', async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      action: req.query.action,
      resourceType: req.query.resourceType,
      severity: req.query.severity,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };
    const result = await AuditLogService.query(filters, pagination);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs', error: error.message });
  }
});

router.get('/audit/activity-report', async (req, res) => {
  try {
    const { duration } = req.query;
    const durationMs = duration ? parseInt(duration) : 86400000;
    const report = await AuditLogService.getActivityReport(durationMs);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch activity report', error: error.message });
  }
});

router.get('/audit/suspicious', async (req, res) => {
  try {
    const { duration } = req.query;
    const durationMs = duration ? parseInt(duration) : 3600000;
    const suspicious = await AuditLogService.getSuspiciousActivity(durationMs);
    res.json({ success: true, data: suspicious });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch suspicious activity', error: error.message });
  }
});

router.get('/alerts/active', (req, res) => {
  try {
    const alerts = HealthAlertService.getActiveAlerts();
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch active alerts', error: error.message });
  }
});

router.get('/alerts/history', (req, res) => {
  try {
    const { limit } = req.query;
    const history = HealthAlertService.getAlertHistory(limit ? parseInt(limit) : 50);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch alert history', error: error.message });
  }
});

router.post('/alerts/:alertId/acknowledge', (req, res) => {
  try {
    const { alertId } = req.params;
    const success = HealthAlertService.acknowledgeAlert(alertId);
    res.json({ success, message: success ? 'Alert acknowledged' : 'Alert not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to acknowledge alert', error: error.message });
  }
});

router.post('/alerts/:alertId/resolve', (req, res) => {
  try {
    const { alertId } = req.params;
    const success = HealthAlertService.resolveAlert(alertId);
    res.json({ success, message: success ? 'Alert resolved' : 'Alert not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to resolve alert', error: error.message });
  }
});

router.post('/deploy', async (req, res) => {
  try {
    const result = await DeploymentService.deploy('manual');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Deployment failed', error: error.message });
  }
});

router.post('/deploy/rollback', async (req, res) => {
  try {
    const { targetVersion } = req.body;
    const result = await DeploymentService.rollback(targetVersion);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Rollback failed', error: error.message });
  }
});

router.get('/deploy/history', (req, res) => {
  try {
    const { limit } = req.query;
    const history = DeploymentService.getDeploymentHistory(limit ? parseInt(limit) : 20);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch deployment history', error: error.message });
  }
});

router.get('/feature-flags', (req, res) => {
  try {
    const { environment } = req.query;
    const flags = environment ? FeatureFlagService.getFlagsByEnvironment(environment) : FeatureFlagService.getAllFlags();
    res.json({ success: true, data: flags });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch feature flags', error: error.message });
  }
});

router.post('/feature-flags', (req, res) => {
  try {
    const flagData = req.body;
    const createdBy = req.user?.userId || 'admin';
    const flag = FeatureFlagService.createFlag(flagData, createdBy);
    res.json({ success: true, data: flag });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create feature flag', error: error.message });
  }
});

router.put('/feature-flags/:flagKey', (req, res) => {
  try {
    const { flagKey } = req.params;
    const updates = req.body;
    const updatedBy = req.user?.userId || 'admin';
    const flag = FeatureFlagService.updateFlag(flagKey, updates, updatedBy);
    res.json({ success: true, data: flag });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update feature flag', error: error.message });
  }
});

router.delete('/feature-flags/:flagKey', (req, res) => {
  try {
    const { flagKey } = req.params;
    const deletedBy = req.user?.userId || 'admin';
    const success = FeatureFlagService.deleteFlag(flagKey, deletedBy);
    res.json({ success, message: success ? 'Feature flag deleted' : 'Feature flag not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete feature flag', error: error.message });
  }
});

router.get('/feature-flags/stats', (req, res) => {
  try {
    const stats = FeatureFlagService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch feature flag stats', error: error.message });
  }
});

module.exports = router;