const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const BackupService = require('./backupService');
const Logger = require('../utils/logger');

const execAsync = promisify(exec);

class DeploymentService {
  constructor() {
    this.isEnabled = process.env.AUTO_DEPLOY_ENABLED !== 'false';
    this.currentVersion = process.env.VERSION || '1.0.0';
    this.deployHistory = [];
    this.maxHistory = 20;
    this.isDeploying = false;
    this.gitRepo = process.env.GIT_REPO || '';
    this.deployBranch = process.env.DEPLOY_BRANCH || 'main';
    this.deployPath = process.env.DEPLOY_PATH || process.cwd();
    this.webhookSecret = process.env.DEPLOY_WEBHOOK_SECRET || '';
  }

  async initialize() {
    if (!this.isEnabled) {
      Logger.info('Auto Deployment is disabled');
      return false;
    }

    try {
      const gitDir = path.join(this.deployPath, '.git');
      try {
        await fs.access(gitDir);
        Logger.info('Deployment Service initialized', { branch: this.deployBranch });
        return true;
      } catch (e) {
        Logger.warn('Not a git repository, deployment service disabled');
        this.isEnabled = false;
        return false;
      }
    } catch (error) {
      Logger.error('Deployment Service initialization failed', { error: error.message });
      return false;
    }
  }

  async deploy(source = 'manual') {
    if (this.isDeploying) {
      return { success: false, message: 'Deployment already in progress' };
    }

    this.isDeploying = true;
    const startTime = Date.now();
    const deployId = this.generateDeployId();

    try {
      Logger.info('Starting deployment', { deployId, source });

      const preDeployBackup = await this.createPreDeployBackup();

      await this.pullLatestCode();
      await this.installDependencies();
      const buildResult = await this.buildApplication();
      await this.runMigrations();
      await this.restartApplication();
      await this.verifyDeployment();

      const duration = Date.now() - startTime;
      const deployRecord = {
        id: deployId,
        timestamp: new Date().toISOString(),
        duration,
        version: this.currentVersion,
        source,
        status: 'success',
        backupId: preDeployBackup?.backupId || null,
        buildResult
      };

      this.deployHistory.unshift(deployRecord);
      if (this.deployHistory.length > this.maxHistory) {
        this.deployHistory.pop();
      }

      if (global.io) {
        global.io.to('admins').emit('deployment:complete', deployRecord);
      }

      Logger.info('Deployment completed successfully', { deployId, duration });

      return {
        success: true,
        deployId,
        version: this.currentVersion,
        duration,
        message: 'Deployment successful'
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      const failedRecord = {
        id: deployId,
        timestamp: new Date().toISOString(),
        duration,
        version: this.currentVersion,
        source,
        status: 'failed',
        error: error.message
      };

      this.deployHistory.unshift(failedRecord);

      Logger.error('Deployment failed', { deployId, error: error.message });

      if (global.io) {
        global.io.to('admins').emit('deployment:failed', failedRecord);
      }

      return {
        success: false,
        deployId,
        error: error.message,
        message: 'Deployment failed'
      };
    } finally {
      this.isDeploying = false;
    }
  }

  async createPreDeployBackup() {
    try {
      const BackupService = require('./backupService');
      if (BackupService.isEnabled) {
        const result = await BackupService.createBackup();
        Logger.info('Pre-deployment backup created', { backupId: result.backupId });
        return result;
      }
    } catch (error) {
      Logger.warn('Pre-deployment backup failed', { error: error.message });
    }
    return null;
  }

  async pullLatestCode() {
    try {
      await execAsync('git fetch origin', { cwd: this.deployPath });
      const result = await execAsync(`git reset --hard origin/${this.deployBranch}`, { cwd: this.deployPath });
      Logger.info('Code pulled from git', { branch: this.deployBranch });
      return result;
    } catch (error) {
      Logger.warn('Git pull failed, continuing with existing code', { error: error.message });
    }
  }

  async installDependencies() {
    try {
      const packageManager = await fs.access(path.join(this.deployPath, 'package-lock.json'))
        .then(() => 'npm ci --only=production')
        .catch(() => 'npm install --only=production');

      const result = await execAsync(packageManager, { cwd: this.deployPath, timeout: 300000 });
      Logger.info('Dependencies installed');
      return result;
    } catch (error) {
      Logger.error('Dependency installation failed', { error: error.message });
      throw new Error(`npm install failed: ${error.message}`);
    }
  }

  async buildApplication() {
    try {
      const hasBuildScript = await this.checkPackageScript('build');

      if (hasBuildScript) {
        const result = await execAsync('npm run build', { cwd: this.deployPath, timeout: 300000 });
        Logger.info('Application built successfully');
        return { built: true, output: result.stdout.slice(-500) };
      }

      return { built: false, reason: 'No build script found' };
    } catch (error) {
      Logger.error('Build failed', { error: error.message });
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  async checkPackageScript(scriptName) {
    try {
      const packageJsonPath = path.join(this.deployPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return !!(packageJson.scripts && packageJson.scripts[scriptName]);
    } catch (error) {
      return false;
    }
  }

  async runMigrations() {
    try {
      const result = await execAsync('npm run migrate', { cwd: this.deployPath, timeout: 120000 });
      Logger.info('Database migrations completed');
      return result;
    } catch (error) {
      Logger.warn('Migration command failed or not found', { error: error.message });
    }
  }

  async restartApplication() {
    try {
      if (process.env.PM2_PROCESS_NAME) {
        await execAsync(`pm2 restart ${process.env.PM2_PROCESS_NAME}`, { timeout: 30000 });
        Logger.info('Application restarted via PM2');
      } else if (process.env.DOCKER_CONTAINER_NAME) {
        await execAsync(`docker restart ${process.env.DOCKER_CONTAINER_NAME}`, { timeout: 60000 });
        Logger.info('Application restarted via Docker');
      } else if (process.env.RENDER_SERVICE_ID) {
        Logger.info('Render auto-deploys on git push, no manual restart needed');
      } else {
        Logger.info('No restart mechanism configured, manual restart required');
      }
    } catch (error) {
      Logger.warn('Application restart failed', { error: error.message });
    }
  }

  async verifyDeployment() {
    try {
      const maxRetries = 10;
      const retryDelay = 3000;

      for (let i = 0; i < maxRetries; i++) {
        try {
          const axios = require('axios');
          const healthUrl = `${process.env.HEALTH_CHECK_URL || 'http://localhost:5000'}/api/health`;
          const response = await axios.get(healthUrl, { timeout: 5000 });

          if (response.status === 200) {
            Logger.info('Deployment verified - health check passed');
            return { verified: true, healthResponse: response.data };
          }
        } catch (error) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      throw new Error('Health check verification failed after retries');
    } catch (error) {
      Logger.error('Deployment verification failed', { error: error.message });
      throw error;
    }
  }

  async rollback(targetVersion = null, options = {}) {
    if (this.isDeploying) {
      return { success: false, message: 'Cannot rollback during deployment' };
    }

    const startTime = Date.now();
    const rollbackId = this.generateDeployId();

    try {
      Logger.info('Starting rollback', { rollbackId, targetVersion });

      const currentDeploy = this.deployHistory[0];
      if (!currentDeploy) {
        throw new Error('No deployment history found');
      }

      let targetDeploy;
      if (targetVersion) {
        targetDeploy = this.deployHistory.find(d => d.version === targetVersion);
      } else {
        targetDeploy = this.deployHistory.find(d => d.status === 'success' && d.id !== currentDeploy.id);
      }

      if (!targetDeploy) {
        throw new Error(targetVersion ? `Version ${targetVersion} not found in history` : 'No previous successful deployment found');
      }

      const targetCommit = await this.getCommitForVersion(targetDeploy.id);

      await execAsync(`git reset --hard ${targetCommit}`, { cwd: this.deployPath });
      await this.installDependencies();
      const buildResult = await this.buildApplication();
      await this.restartApplication();
      await this.verifyDeployment();

      const duration = Date.now() - startTime;

      const rollbackRecord = {
        id: rollbackId,
        timestamp: new Date().toISOString(),
        duration,
        type: 'rollback',
        fromVersion: currentDeploy.version,
        toVersion: targetDeploy.version,
        targetCommit,
        status: 'success'
      };

      this.deployHistory.unshift(rollbackRecord);

      this.currentVersion = targetDeploy.version;

      if (global.io) {
        global.io.to('admins').emit('deployment:rollback', rollbackRecord);
      }

      Logger.info('Rollback completed successfully', {
        rollbackId,
        from: currentDeploy.version,
        to: targetDeploy.version
      });

      return {
        success: true,
        rollbackId,
        fromVersion: currentDeploy.version,
        toVersion: targetDeploy.version,
        duration,
        message: 'Rollback successful'
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      Logger.error('Rollback failed', { rollbackId, error: error.message });

      return {
        success: false,
        rollbackId,
        error: error.message,
        message: 'Rollback failed'
      };
    }
  }

  async getCommitForVersion(deployId) {
    try {
      const result = await execAsync('git log --oneline -20', { cwd: this.deployPath });
      const commits = result.stdout.split('\n').filter(c => c.trim());

      const deploy = this.deployHistory.find(d => d.id === deployId);
      if (deploy && deploy.gitCommit) {
        return deploy.gitCommit;
      }

      return commits[0]?.split(' ')[0];
    } catch (error) {
      return 'HEAD~1';
    }
  }

  async getDeploymentHistory(limit = 20) {
    return {
      total: this.deployHistory.length,
      currentVersion: this.currentVersion,
      history: this.deployHistory.slice(0, limit)
    };
  }

  getCurrentVersion() {
    return this.currentVersion;
  }

  async verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const expectedSignature = `sha256=${hmac.update(payload).digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  }

  async handleWebhook(payload, signature) {
    try {
      const isValid = await this.verifyWebhookSignature(JSON.stringify(payload), signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const event = payload?.ref?.split('/').pop() || 'unknown';
      if (event !== this.deployBranch) {
        return { success: true, message: `Ignoring push to ${event}, deploying ${this.deployBranch} only` };
      }

      const delay = parseInt(process.env.DEPLOY_DELAY_MS) || 0;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return await this.deploy('webhook');
    } catch (error) {
      Logger.error('Webhook handling failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  generateDeployId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `deploy-${timestamp}`;
  }

  getStats() {
    return {
      enabled: this.isEnabled,
      currentVersion: this.currentVersion,
      branch: this.deployBranch,
      deploying: this.isDeploying,
      totalDeployments: this.deployHistory.length,
      successfulDeploys: this.deployHistory.filter(d => d.status === 'success').length,
      failedDeploys: this.deployHistory.filter(d => d.status === 'failed').length,
      lastDeployment: this.deployHistory[0] || null
    };
  }

  getHealthStatus() {
    const recentDeploys = this.deployHistory.slice(0, 5);
    const failedRecent = recentDeploys.filter(d => d.status === 'failed').length;

    let status = 'healthy';
    if (this.isDeploying) status = 'deploying';
    else if (failedRecent >= 2) status = 'degraded';
    else if (failedRecent >= 1) status = 'warning';

    return {
      status,
      currentVersion: this.currentVersion,
      isDeploying: this.isDeploying,
      recentFailures: failedRecent
    };
  }
}

module.exports = new DeploymentService();