const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const Logger = require('../utils/logger');

const execAsync = promisify(exec);

class BackupService {
  constructor() {
    this.isEnabled = process.env.BACKUP_ENABLED !== 'false';
    this.backupDir = process.env.BACKUP_DIR || './backups';
    this.maxBackups = parseInt(process.env.MAX_BACKUPS) || 24;
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 7;
    this.compressionEnabled = process.env.BACKUP_COMPRESSION === 'true';
    this.backupInterval = null;
    this.isBackupServer = process.env.BACKUP_SERVER_MODE === 'true';
    this.primaryServer = process.env.PRIMARY_SERVER_URL || '';
    this.lastBackupTime = null;
    this.backupHistory = [];
  }

  async initialize() {
    if (!this.isEnabled) {
      Logger.info('Backup Service is disabled');
      return false;
    }

    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'database'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'media'), { recursive: true });

      if (this.isBackupServer) {
        Logger.info('🔄 Running as backup server mode');
        this.startSyncFromPrimary();
      } else {
        Logger.info('💾 Running as primary server, starting scheduled backups');
        this.startScheduledBackups();
      }

      Logger.info('Backup Service initialized', {
        backupDir: this.backupDir,
        maxBackups: this.maxBackups,
        isBackupServer: this.isBackupServer
      });

      return true;
    } catch (error) {
      Logger.error('Backup Service initialization failed', { error: error.message });
      return false;
    }
  }

  startScheduledBackups() {
    const backupIntervalMs = parseInt(process.env.BACKUP_INTERVAL_MS) || 3600000;

    this.backupInterval = setInterval(async () => {
      await this.createBackup();
    }, backupIntervalMs);

    Logger.info(`Scheduled backups every ${backupIntervalMs / 1000 / 60} minutes`);
  }

  startSyncFromPrimary() {
    if (!this.primaryServer) {
      Logger.warn('No primary server configured for backup server mode');
      return;
    }

    this.backupInterval = setInterval(async () => {
      await this.syncFromPrimary();
    }, 3600000);

    Logger.info('Sync from primary server scheduled');
  }

  async createBackup() {
    const startTime = Date.now();
    const backupId = this.generateBackupId();
    const backupPath = path.join(this.backupDir, 'database', backupId);

    try {
      Logger.info(`Starting backup: ${backupId}`);

      await fs.mkdir(backupPath, { recursive: true });

      const dbStats = await this.backupDatabase(backupPath);
      const configBackup = await this.backupConfig(backupPath);
      const uploadsBackup = await this.backupMediaAssets(backupPath);

      const manifest = {
        backupId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        database: dbStats,
        config: configBackup,
        media: uploadsBackup,
        compression: this.compressionEnabled,
        serverVersion: process.env.VERSION || '1.0.0'
      };

      await fs.writeFile(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      const backupSize = await this.calculateBackupSize(backupPath);
      manifest.size = backupSize;

      if (this.compressionEnabled) {
        await this.compressBackup(backupPath, backupId);
      }

      this.lastBackupTime = new Date();
      this.backupHistory.unshift({
        id: backupId,
        timestamp: this.lastBackupTime,
        size: backupSize,
        status: 'success',
        duration: manifest.duration
      });

      if (this.backupHistory.length > this.maxBackups) {
        this.backupHistory.pop();
      }

      await this.cleanupOldBackups();

      Logger.info('Backup completed successfully', {
        backupId,
        size: `${(backupSize / 1024 / 1024).toFixed(2)} MB`,
        duration: `${manifest.duration}ms`
      });

      return {
        success: true,
        backupId,
        size: backupSize,
        timestamp: this.lastBackupTime
      };
    } catch (error) {
      Logger.error('Backup failed', { backupId, error: error.message });

      this.backupHistory.unshift({
        id: backupId,
        timestamp: new Date(),
        size: 0,
        status: 'failed',
        error: error.message
      });

      throw error;
    }
  }

  async backupDatabase(backupPath) {
    try {
      const dbName = mongoose.connection.name;
      const mongoDumpPath = path.join(backupPath, 'mongodb_dump');

      await fs.mkdir(mongoDumpPath, { recursive: true });

      const uri = process.env.MONGO_URI;
      const dbUser = process.env.MONGO_ROOT_USERNAME;
      const dbPass = process.env.MONGO_ROOT_PASSWORD;

      let authParams = '';
      if (dbUser && dbPass) {
        authParams = `-u ${dbUser} -p ${dbPass}`;
      }

      const mongodumpCmd = `mongodump --uri="${uri}" --archive="${path.join(mongoDumpPath, 'dump.archive')}" --gzip`;

      await execAsync(mongodumpCmd, { maxBuffer: 50 * 1024 * 1024 });

      const collections = Object.keys(mongoose.connection.collections);
      const collectionStats = {};

      for (const collectionName of collections) {
        try {
          const count = await mongoose.connection.collection(collectionName).countDocuments();
          collectionStats[collectionName] = count;
        } catch (e) {
          collectionStats[collectionName] = 'error';
        }
      }

      return {
        name: dbName,
        collections: collectionStats,
        totalCollections: collections.length,
        dumpPath: mongoDumpPath
      };
    } catch (error) {
      Logger.error('Database backup failed', { error: error.message });
      throw error;
    }
  }

  async backupConfig(backupPath) {
    try {
      const configFiles = ['.env', '.env.production', 'config.json', 'firebase.json'];
      const configDir = path.join(backupPath, 'config');

      await fs.mkdir(configDir, { recursive: true });

      const backedUpFiles = {};

      for (const file of configFiles) {
        try {
          const filePath = path.join(process.cwd(), file);
          const content = await fs.readFile(filePath, 'utf-8');
          const sanitizedContent = this.sanitizeConfigContent(content);
          await fs.writeFile(path.join(configDir, file), sanitizedContent);
          backedUpFiles[file] = 'backed_up';
        } catch (e) {
          backedUpFiles[file] = 'not_found';
        }
      }

      return backedUpFiles;
    } catch (error) {
      Logger.error('Config backup failed', { error: error.message });
      throw error;
    }
  }

  sanitizeConfigContent(content) {
    return content
      .replace(/(MONGO_ROOT_PASSWORD\s*=\s*)(.+)/g, '$1[REDACTED]')
      .replace(/(JWT_SECRET\s*=\s*)(.+)/g, '$1[REDACTED]')
      .replace(/(SECRET_KEY\s*=\s*)(.+)/g, '$1[REDACTED]')
      .replace(/(PASSWORD\s*=\s*)(.+)/g, '$1[REDACTED]');
  }

  async backupMediaAssets(backupPath) {
    try {
      const mediaDir = path.join(backupPath, 'media');
      await fs.mkdir(mediaDir, { recursive: true });

      const sourceMediaDir = path.join(process.cwd(), 'uploads');
      let totalFiles = 0;

      try {
        const files = await fs.readdir(sourceMediaDir);
        totalFiles = files.length;

        for (const file of files) {
          const sourcePath = path.join(sourceMediaDir, file);
          const destPath = path.join(mediaDir, file);
          await fs.copyFile(sourcePath, destPath);
        }
      } catch (e) {
        Logger.info('No media directory found, skipping');
      }

      return {
        totalFiles,
        status: totalFiles > 0 ? 'backed_up' : 'no_media'
      };
    } catch (error) {
      Logger.error('Media backup failed', { error: error.message });
      throw error;
    }
  }

  async compressBackup(backupPath, backupId) {
    try {
      const compressedPath = `${backupPath}.tar.gz`;
      const tarCmd = `tar -czf "${compressedPath}" -C "${path.dirname(backupPath)}" "${path.basename(backupPath)}"`;

      await execAsync(tarCmd);
      await fs.rm(backupPath, { recursive: true });

      Logger.info('Backup compressed', { backupId, path: compressedPath });
    } catch (error) {
      Logger.error('Backup compression failed', { backupId, error: error.message });
    }
  }

  async cleanupOldBackups() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      const backupDirs = await fs.readdir(path.join(this.backupDir, 'database'));

      for (const dir of backupDirs) {
        const dirPath = path.join(this.backupDir, 'database', dir);
        try {
          const stats = await fs.stat(dirPath);
          if (stats.mtime < cutoffDate) {
            await fs.rm(dirPath, { recursive: true });

            const compressedPath = `${dirPath}.tar.gz`;
            try {
              await fs.unlink(compressedPath);
            } catch (e) {
            }

            Logger.info('Old backup removed', { backupId: dir, age: this.retentionDays });
          }
        } catch (e) {
          Logger.warn('Failed to remove old backup', { dir, error: e.message });
        }
      }
    } catch (error) {
      Logger.error('Cleanup old backups failed', { error: error.message });
    }
  }

  async restoreBackup(backupId) {
    const startTime = Date.now();

    try {
      const backupPath = path.join(this.backupDir, 'database', backupId);
      const compressedPath = `${backupPath}.tar.gz`;

      if (!await this.backupExists(backupId)) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      Logger.info(`Starting restore: ${backupId}`);

      await this.createBackup();

      if (await fs.access(compressedPath).then(() => true).catch(() => false)) {
        const extractCmd = `tar -xzf "${compressedPath}" -C "${path.dirname(backupPath)}"`;
        await execAsync(extractCmd);
      }

      const manifestPath = path.join(backupPath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const restoreMongoCmd = `mongorestore --uri="${process.env.MONGO_URI}" --archive="${path.join(backupPath, 'mongodb_dump', 'dump.archive')}" --gzip --drop`;
      await execAsync(restoreMongoCmd, { maxBuffer: 50 * 1024 * 1024 });

      await this.disconnectAllClients();

      const duration = Date.now() - startTime;

      Logger.info('Restore completed successfully', {
        backupId,
        duration,
        collections: Object.keys(manifest.database.collections).length
      });

      return {
        success: true,
        backupId,
        duration,
        collectionsRestored: Object.keys(manifest.database.collections).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      Logger.error('Restore failed', { backupId, error: error.message });
      throw error;
    }
  }

  async disconnectAllClients() {
    try {
      if (global.io) {
        global.io.disconnectSockets();
      }
    } catch (e) {
      Logger.warn('Failed to disconnect sockets', { error: e.message });
    }
  }

  async backupExists(backupId) {
    const backupPath = path.join(this.backupDir, 'database', backupId);
    const compressedPath = `${backupPath}.tar.gz`;

    try {
      await fs.access(backupPath);
      return true;
    } catch (e) {
      try {
        await fs.access(compressedPath);
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  async syncFromPrimary() {
    try {
      if (!this.primaryServer) {
        throw new Error('Primary server URL not configured');
      }

      const axios = require('axios');
      const response = await axios.post(`${this.primaryServer}/api/admin/backup/create`, {}, {
        timeout: 300000,
        headers: { 'Authorization': `Bearer ${process.env.BACKUP_SYNC_TOKEN}` }
      });

      if (response.data.success) {
        Logger.info('Synced backup from primary', { backupId: response.data.backupId });
      }
    } catch (error) {
      Logger.error('Sync from primary failed', { error: error.message });
    }
  }

  generateBackupId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `backup-${timestamp}`;
  }

  async calculateBackupSize(dirPath) {
    try {
      let totalSize = 0;

      const calcSize = async (dir) => {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          if (stats.isDirectory()) {
            await calcSize(filePath);
          } else {
            totalSize += stats.size;
          }
        }
      };

      await calcSize(dirPath);
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  getBackupHistory() {
    return {
      total: this.backupHistory.length,
      recent: this.backupHistory.slice(0, 10),
      lastBackup: this.lastBackupTime,
      enabled: this.isEnabled
    };
  }

  getBackupStats() {
    return {
      isEnabled: this.isEnabled,
      backupDir: this.backupDir,
      maxBackups: this.maxBackups,
      retentionDays: this.retentionDays,
      isBackupServer: this.isBackupServer,
      primaryServer: this.primaryServer ? '[CONFIGURED]' : 'NOT CONFIGURED',
      lastBackup: this.lastBackupTime,
      totalBackups: this.backupHistory.length,
      successfulBackups: this.backupHistory.filter(b => b.status === 'success').length,
      failedBackups: this.backupHistory.filter(b => b.status === 'failed').length
    };
  }

  stop() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      Logger.info('Backup Service stopped');
    }
  }
}

module.exports = new BackupService();