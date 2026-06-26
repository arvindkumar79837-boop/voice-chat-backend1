const EventEmitter = require('events');
const Logger = require('../utils/logger');

class FeatureFlagService extends EventEmitter {
  constructor() {
    super();
    this.isEnabled = process.env.FEATURE_FLAGS_ENABLED !== 'false';
    this.flags = new Map();
    this.overrideRules = new Map();
    this.rolloutHistory = [];
    this.maxHistory = 100;
    this.defaultTtl = parseInt(process.env.FEATURE_FLAG_TTL) || 86400000;
  }

  initialize() {
    if (!this.isEnabled) {
      Logger.info('Feature Flag Service is disabled');
      return false;
    }

    this.loadDefaultFlags();

    Logger.info('Feature Flag Service initialized', {
      flagCount: this.flags.size
    });

    return true;
  }

  loadDefaultFlags() {
    const defaultFlags = [
      {
        key: 'new_games_enabled',
        name: 'New Games Feature',
        description: 'Enables new games like Lucky Wheel, Scratch Card',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: [],
        environments: ['staging'],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        key: 'webview_games',
        name: 'WebView Games',
        description: 'Enables WebView-based mini games',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: [],
        environments: [],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        key: 'advanced_analytics',
        name: 'Advanced Analytics Dashboard',
        description: 'Enables advanced analytics for admins',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: ['admin', 'super_admin'],
        environments: ['production', 'staging'],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        key: 'family_war_2v2',
        name: 'Family War 2v2 Mode',
        description: 'Enables 2v2 family war battles',
        enabled: false,
        rolloutPercentage: 10,
        targetUsers: [],
        environments: ['staging'],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        key: 'new_onboarding',
        name: 'New User Onboarding Flow',
        description: 'Enables redesigned onboarding experience',
        enabled: true,
        rolloutPercentage: 50,
        targetUsers: [],
        environments: ['staging'],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        key: 'dark_mode',
        name: 'Dark Mode',
        description: 'Enables dark mode theme for app',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: [],
        environments: ['production', 'staging'],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        key: 'video_gifts',
        name: 'Video Gifts',
        description: 'Enables video-based gift animations',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: ['beta_tester'],
        environments: ['staging'],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        key: 'ai_recommendations',
        name: 'AI-Powered Recommendations',
        description: 'Enables AI-based user recommendations',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: [],
        environments: [],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        key: 'live_streaming',
        name: 'Live Streaming Feature',
        description: 'Enables live streaming capabilities',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: [],
        environments: [],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        key: 'crypto_payments',
        name: 'Cryptocurrency Payments',
        description: 'Enables crypto payment gateway',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: [],
        environments: [],
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      }
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });
  }

  isFeatureEnabled(flagKey, user = {}) {
    if (!this.isEnabled) {
      return true;
    }

    const flag = this.flags.get(flagKey);
    if (!flag) {
      Logger.warn('Feature flag not found', { flagKey });
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    const environment = process.env.NODE_ENV || 'development';
    if (flag.environments.length > 0 && !flag.environments.includes(environment)) {
      return false;
    }

    if (flag.targetUsers.length > 0) {
      const userRoles = user.roles || [user.role];
      const hasAccess = flag.targetUsers.some(role => userRoles.includes(role));
      if (!hasAccess) {
        return false;
      }
    }

    if (flag.rolloutPercentage < 100 && user.userId) {
      const hash = this.hashUserId(user.userId);
      const userBucket = hash % 100;
      if (userBucket >= flag.rolloutPercentage) {
        return false;
      }
    }

    return true;
  }

  hashUserId(userId) {
    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  createFlag(flagData, createdBy) {
    if (this.flags.has(flagData.key)) {
      throw new Error(`Feature flag already exists: ${flagData.key}`);
    }

    const flag = {
      key: flagData.key,
      name: flagData.name || flagData.key,
      description: flagData.description || '',
      enabled: flagData.enabled || false,
      rolloutPercentage: flagData.rolloutPercentage ?? 0,
      targetUsers: flagData.targetUsers || [],
      environments: flagData.environments || [],
      createdAt: new Date().toISOString(),
      createdBy,
      updatedAt: new Date().toISOString()
    };

    this.flags.set(flag.key, flag);
    this.recordChange('create', flag.key, flag, createdBy);
    this.emit('flag:created', flag);

    Logger.info('Feature flag created', { key: flag.key, enabled: flag.enabled, createdBy });
    return flag;
  }

  updateFlag(flagKey, updates, updatedBy) {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      throw new Error(`Feature flag not found: ${flagKey}`);
    }

    const oldValues = {
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      targetUsers: [...flag.targetUsers],
      environments: [...flag.environments]
    };

    if (updates.enabled !== undefined) flag.enabled = updates.enabled;
    if (updates.rolloutPercentage !== undefined) flag.rolloutPercentage = updates.rolloutPercentage;
    if (updates.targetUsers !== undefined) flag.targetUsers = updates.targetUsers;
    if (updates.environments !== undefined) flag.environments = updates.environments;
    if (updates.name !== undefined) flag.name = updates.name;
    if (updates.description !== undefined) flag.description = updates.description;

    flag.updatedAt = new Date().toISOString();
    flag.updatedBy = updatedBy;

    this.recordChange('update', flagKey, { oldValues, newValues: updates }, updatedBy);
    this.emit('flag:updated', flag);

    Logger.info('Feature flag updated', {
      key: flagKey,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      updatedBy
    });

    return flag;
  }

  deleteFlag(flagKey, deletedBy) {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      throw new Error(`Feature flag not found: ${flagKey}`);
    }

    this.flags.delete(flagKey);
    this.recordChange('delete', flagKey, flag, deletedBy);
    this.emit('flag:deleted', flagKey);

    Logger.info('Feature flag deleted', { key: flagKey, deletedBy });
    return true;
  }

  setOverride(flagKey, value, userId, expiresIn = null) {
    const override = {
      flagKey,
      value,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn).toISOString() : null
    };

    this.overrideRules.set(`${flagKey}_${userId}`, override);

    Logger.info('Feature flag override set', { flagKey, userId, value });
    return override;
  }

  removeOverride(flagKey, userId) {
    const key = `${flagKey}_${userId}`;
    const removed = this.overrideRules.delete(key);
    if (removed) {
      Logger.info('Feature flag override removed', { flagKey, userId });
    }
    return removed;
  }

  getOverride(flagKey, userId) {
    const override = this.overrideRules.get(`${flagKey}_${userId}`);
    if (!override) return null;

    if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
      this.overrideRules.delete(`${flagKey}_${userId}`);
      return null;
    }

    return override.value;
  }

  getFlag(flagKey) {
    return this.flags.get(flagKey) || null;
  }

  getAllFlags() {
    return Array.from(this.flags.values());
  }

  getFlagsByEnvironment(environment) {
    return this.getAllFlags().filter(flag =>
      flag.environments.length === 0 || flag.environments.includes(environment)
    );
  }

  recordChange(action, flagKey, data, userId) {
    this.rolloutHistory.unshift({
      action,
      flagKey,
      data,
      userId,
      timestamp: new Date().toISOString()
    });

    if (this.rolloutHistory.length > this.maxHistory) {
      this.rolloutHistory.pop();
    }
  }

  getRolloutHistory(limit = 50) {
    return this.rolloutHistory.slice(0, limit);
  }

  getStats() {
    const total = this.flags.size;
    const enabled = Array.from(this.flags.values()).filter(f => f.enabled).length;
    const disabled = total - enabled;
    const environment = process.env.NODE_ENV || 'development';

    return {
      enabled: this.isEnabled,
      totalFlags: total,
      enabledFlags: enabled,
      disabledFlags: disabled,
      activeOverrides: this.overrideRules.size,
      environment,
      recentChanges: this.rolloutHistory.slice(0, 10)
    };
  }

  getHealthStatus() {
    return {
      status: this.isEnabled ? 'healthy' : 'disabled',
      totalFlags: this.flags.size,
      enabledFlags: Array.from(this.flags.values()).filter(f => f.enabled).length
    };
  }

  bulkUpdateFlags(updates, updatedBy) {
    const results = [];
    try {
      for (const update of updates) {
        const flag = this.updateFlag(update.key, update.values, updatedBy);
        results.push({ key: update.key, success: true, flag });
      }
      return { success: true, updated: results.length, results };
    } catch (error) {
      return { success: false, error: error.message, results };
    }
  }

  exportFlags() {
    return {
      flags: this.getAllFlags(),
      overrides: Array.from(this.overrideRules.values()),
      history: this.rolloutHistory,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  importFlags(data, importedBy) {
    try {
      if (data.flags && Array.isArray(data.flags)) {
        data.flags.forEach(flag => {
          if (!this.flags.has(flag.key)) {
            this.flags.set(flag.key, flag);
            this.recordChange('import', flag.key, flag, importedBy);
          }
        });
      }

      if (data.overrides && Array.isArray(data.overrides)) {
        data.overrides.forEach(override => {
          this.overrideRules.set(`${override.flagKey}_${override.userId}`, override);
        });
      }

      Logger.info('Feature flags imported', {
        flagsCount: data.flags?.length || 0,
        overridesCount: data.overrides?.length || 0,
        importedBy
      });

      this.emit('flags:imported', { flagsCount: data.flags?.length || 0 });
      return true;
    } catch (error) {
      Logger.error('Failed to import feature flags', { error: error.message });
      return false;
    }
  }
}

module.exports = new FeatureFlagService();