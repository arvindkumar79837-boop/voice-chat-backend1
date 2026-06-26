const mongoose = require('mongoose');

const powerMatrixSchema = new mongoose.Schema({
  isActive: {
    type: Boolean,
    default: true
  },
  rules: [{
    level: {
      type: Number,
      required: true,
      min: 1
    },
    canMuteLowerLevels: {
      type: Boolean,
      default: false
    },
    canKickLowerLevels: {
      type: Boolean,
      default: false
    },
    muteLevelThreshold: {
      type: Number,
      default: 0,
      min: 0,
      description: 'Minimum level required to mute users at this level'
    },
    kickLevelThreshold: {
      type: Number,
      default: 0,
      min: 0,
      description: 'Minimum level required to kick users at this level'
    },
    vipProtectionLevel: {
      type: Number,
      default: 0,
      min: 0,
      description: 'Level above which VIP protection activates'
    },
    specialPrivileges: [{
      privilege: {
        type: String,
        enum: ['bypass_mute', 'bypass_kick', 'force_unmute', 'force_unkick', 'admin_access'],
        required: true
      },
      appliesToLevel: {
        type: Number,
        required: true,
        min: 1
      },
      description: {
        type: String,
        default: ''
      }
    }]
  }],
  globalSettings: {
    ownerCanOverrideAll: {
      type: Boolean,
      default: true,
      description: 'Owner can always mute/kick regardless of level comparison'
    },
    adminCanOverrideVip: {
      type: Boolean,
      default: true,
      description: 'Higher-level admins can manage VIP users'
    },
    svipImmunityLevel: {
      type: Number,
      default: 10,
      min: 1,
      description: 'SVIP users above this level cannot be muted/kicked by anyone except owner'
    },
    vipImmunityLevel: {
      type: Number,
      default: 8,
      min: 1,
      description: 'VIP users above this level require special privileges to manage'
    },
    levelDifferenceRequired: {
      type: Number,
      default: 2,
      min: 1,
      description: 'Minimum level difference required to perform actions'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

powerMatrixSchema.index({ isActive: 1 });
powerMatrixSchema.index({ createdAt: -1 });

powerMatrixSchema.virtual('activeRules').get(function() {
  if (!this.isActive) return [];
  return this.rules.filter(rule => rule.level > 0).sort((a, b) => b.level - a.level);
});

powerMatrixSchema.methods.getUserLevelRule = function(level) {
  return this.rules.find(rule => rule.level === level) || null;
};

powerMatrixSchema.methods.canUserMute = function(actorLevel, targetLevel, actorRole, targetRole) {
  if (!this.isActive) return { allowed: true, reason: 'Power matrix inactive' };
  
  if (this.globalSettings.ownerCanOverrideAll && (actorRole === 'owner')) {
    return { allowed: true, reason: 'Owner override' };
  }
  
  if (actorLevel <= targetLevel) {
    return { allowed: false, reason: 'Target level is higher or equal' };
  }
  
  const requiredDiff = this.globalSettings.levelDifferenceRequired;
  if ((actorLevel - targetLevel) < requiredDiff) {
    return { allowed: false, reason: `Level difference must be at least ${requiredDiff}` };
  }
  
  const targetRule = this.getUserLevelRule(targetLevel);
  if (targetRule && !targetRule.canMuteLowerLevels) {
    return { allowed: false, reason: 'Target level does not allow muting lower levels' };
  }
  
  const actorRule = this.getUserLevelRule(actorLevel);
  if (actorRule && actorRule.muteLevelThreshold > 0 && targetLevel >= actorRule.muteLevelThreshold) {
    return { allowed: false, reason: 'Target level is above mute threshold' };
  }
  
  return { allowed: true, reason: 'Action authorized' };
};

powerMatrixSchema.methods.canUserKick = function(actorLevel, targetLevel, actorRole, targetRole) {
  if (!this.isActive) return { allowed: true, reason: 'Power matrix inactive' };
  
  if (this.globalSettings.ownerCanOverrideAll && (actorRole === 'owner')) {
    return { allowed: true, reason: 'Owner override' };
  }
  
  if (actorLevel <= targetLevel) {
    return { allowed: false, reason: 'Target level is higher or equal' };
  }
  
  const requiredDiff = this.globalSettings.levelDifferenceRequired;
  if ((actorLevel - targetLevel) < requiredDiff) {
    return { allowed: false, reason: `Level difference must be at least ${requiredDiff}` };
  }
  
  const targetRule = this.getUserLevelRule(targetLevel);
  if (targetRule && !targetRule.canKickLowerLevels) {
    return { allowed: false, reason: 'Target level does not allow kicking lower levels' };
  }
  
  const actorRule = this.getUserLevelRule(actorLevel);
  if (actorRule && actorRule.kickLevelThreshold > 0 && targetLevel >= actorRule.kickLevelThreshold) {
    return { allowed: false, reason: 'Target level is above kick threshold' };
  }
  
  const isVip = targetRole === 'vip' || targetRole === 'svip';
  const svipLevel = this.globalSettings.svipImmunityLevel;
  const vipLevel = this.globalSettings.vipImmunityLevel;
  
  if (isVip && targetLevel >= svipLevel) {
    return { allowed: false, reason: 'SVIP immunity level protection' };
  }
  
  if (isVip && targetLevel >= vipLevel) {
    return { allowed: false, reason: 'VIP immunity level protection' };
  }
  
  return { allowed: true, reason: 'Action authorized' };
};

powerMatrixSchema.methods.getActionLog = function() {
  return {
    isActive: this.isActive,
    rules: this.rules.map(r => ({
      level: r.level,
      canMute: r.canMuteLowerLevels,
      canKick: r.canKickLowerLevels,
      muteThreshold: r.muteLevelThreshold,
      kickThreshold: r.kickLevelThreshold
    })),
    globalSettings: this.globalSettings,
    updatedAt: this.updatedAt,
    version: this.version
  };
};

module.exports = mongoose.model('PowerMatrix', powerMatrixSchema);