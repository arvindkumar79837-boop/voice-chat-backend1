// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/models/Staff.js
// ARVIND PARTY - STAFF/ADMIN USER MODEL WITH FULL ROLE HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  loginId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    default: '',
  },
  phone: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    required: true,
    enum: [
      'owner',
      'super_admin',
      'admin',
      'sub_admin',
      'moderator',
      'support_staff',
      'user_manager',
      'agency_manager',
      'family_manager',
      'finance_manager',
      'event_manager',
      'cms_manager',
      'banner_manager',
      'advertisement_manager',
      'gift_manager',
      'vip_manager',
      'audit_manager',
      'reports_manager',
      'backup_manager',
      'settings_manager',
    ],
    index: true,
  },
  roleLevel: {
    type: Number,
    default: 0,
    index: true,
  },
  parentRole: {
    type: String,
    default: '',
  },
  department: {
    type: String,
    default: '',
    enum: ['', 'user_management', 'agency_management', 'content_management', 'finance', 'events', 'support', 'system'],
  },
  managedModule: {
    type: String,
    default: '',
    enum: ['', 'users', 'agencies', 'families', 'finance', 'events', 'content', 'banners', 'ads', 'gifts', 'vip', 'reports', 'audit', 'backup', 'settings', 'moderation'],
  },
  granularPermissions: {
    type: Map,
    of: {
      canView: { type: Boolean, default: false },
      canCreate: { type: Boolean, default: false },
      canEdit: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false },
      canApprove: { type: Boolean, default: false },
      canBan: { type: Boolean, default: false },
      canAssign: { type: Boolean, default: false },
    },
    default: {},
  },
  legacyPermissions: {
    type: Map,
    of: Boolean,
    default: {},
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
  },
  otpBackupCodes: {
    type: [String],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isOwnerLocked: {
    type: Boolean,
    default: false,
  },
  assignedCountry: {
    type: String,
    default: '',
  },
  workingHours: {
    start: { type: String, default: '09:00' },
    end: { type: String, default: '18:00' },
    timezone: { type: String, default: 'Asia/Kolkata' },
  },
  lastLoginAt: {
    type: Date,
  },
  loginHistory: {
    type: [{
      ip: String,
      userAgent: String,
      timestamp: { type: Date, default: Date.now },
      success: { type: Boolean, default: true },
    }],
    default: [],
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  lockedUntil: {
    type: Date,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
  notes: {
    type: String,
    default: '',
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

staffSchema.index({ role: 1, roleLevel: -1 });
staffSchema.index({ department: 1, managedModule: 1 });
staffSchema.index({ isActive: 1, createdAt: -1 });

staffSchema.statics.getRoleHierarchy = function () {
  return {
    owner: { level: 100, label: 'Owner', labelHi: 'ओनर', color: '#FFD700', canManage: ['all'] },
    super_admin: { level: 90, label: 'Super Admin', labelHi: 'सुपर एडमिन', color: '#FF6B6B', canManage: ['super_admin', 'admin', 'sub_admin', 'moderator', 'support_staff', 'user_manager', 'agency_manager', 'family_manager', 'finance_manager', 'event_manager', 'cms_manager', 'banner_manager', 'advertisement_manager', 'gift_manager', 'vip_manager', 'audit_manager', 'reports_manager', 'backup_manager', 'settings_manager'] },
    admin: { level: 80, label: 'Admin', labelHi: 'एडमिन', color: '#4ECDC4', canManage: ['sub_admin', 'moderator', 'support_staff'] },
    sub_admin: { level: 70, label: 'Sub Admin', labelHi: 'सब-एडमिन', color: '#45B7D1', canManage: ['moderator', 'support_staff'] },
    moderator: { level: 60, label: 'Moderator', labelHi: 'मॉडरेटर', color: '#96CEB4', canManage: ['support_staff'] },
    support_staff: { level: 50, label: 'Support Staff', labelHi: 'सपोर्ट स्टाफ', color: '#FFEAA7', canManage: [] },
    user_manager: { level: 65, label: 'User Manager', labelHi: 'यूज़र मैनेजर', color: '#DDA0DD', canManage: [], department: 'user_management', managedModule: 'users' },
    agency_manager: { level: 65, label: 'Agency Manager', labelHi: 'एजेंसी मैनेजर', color: '#DDA0DD', department: 'agency_management', managedModule: 'agencies' },
    family_manager: { level: 65, label: 'Family Manager', labelHi: 'फैमिली मैनेजर', color: '#DDA0DD', department: 'user_management', managedModule: 'families' },
    finance_manager: { level: 65, label: 'Finance Manager', labelHi: 'फाइनेंस मैनेजर', color: '#DDA0DD', department: 'finance', managedModule: 'finance' },
    event_manager: { level: 65, label: 'Event Manager', labelHi: 'इवेंट मैनेजर', color: '#DDA0DD', department: 'events', managedModule: 'events' },
    cms_manager: { level: 55, label: 'CMS Manager', labelHi: 'सीएमएस मैनेजर', color: '#98D8C8', department: 'content_management', managedModule: 'content' },
    banner_manager: { level: 55, label: 'Banner Manager', labelHi: 'बैनर मैनेजर', color: '#98D8C8', department: 'content_management', managedModule: 'banners' },
    advertisement_manager: { level: 55, label: 'Ad Manager', labelHi: 'विज्ञापन मैनेजर', color: '#98D8C8', department: 'content_management', managedModule: 'ads' },
    gift_manager: { level: 55, label: 'Gift Manager', labelHi: 'गिफ्ट मैनेजर', color: '#98D8C8', department: 'content_management', managedModule: 'gifts' },
    vip_manager: { level: 55, label: 'VIP Manager', labelHi: 'वीआईपी मैनेजर', color: '#98D8C8', department: 'content_management', managedModule: 'vip' },
    audit_manager: { level: 60, label: 'Audit Manager', labelHi: 'ऑडिट मैनेजर', color: '#F7DC6F', department: 'system', managedModule: 'audit' },
    reports_manager: { level: 60, label: 'Reports Manager', labelHi: 'रिपोर्ट मैनेजर', color: '#F7DC6F', department: 'system', managedModule: 'reports' },
    backup_manager: { level: 70, label: 'Backup Manager', labelHi: 'बैकअप मैनेजर', color: '#E8DAEF', department: 'system', managedModule: 'backup' },
    settings_manager: { level: 75, label: 'Settings Manager', labelHi: 'सेटिंग्स मैनेजर', color: '#D5F5E3', department: 'system', managedModule: 'settings' },
  };
};

staffSchema.statics.ROLE_HIERARCHY = staffSchema.statics.getRoleHierarchy();

staffSchema.statics.ALL_ROLES = Object.keys(staffSchema.statics.getRoleHierarchy());

staffSchema.statics.ALL_PERMISSIONS = [
  'staff.create', 'staff.edit', 'staff.delete', 'staff.view',
  'user.ban', 'user.unban', 'user.edit', 'user.view', 'user.verify',
  'wallet.adjust', 'withdrawal.approve', 'withdrawal.reject',
  'agency.approve', 'agency.revoke', 'agency.view',
  'family.approve', 'family.delete', 'family.view',
  'event.create', 'event.edit', 'event.delete', 'event.view',
  'content.edit', 'content.publish',
  'banner.upload', 'banner.delete', 'banner.view',
  'ad.manage', 'ad.view',
  'gift.create', 'gift.edit', 'gift.delete', 'gift.view',
  'vip.manage', 'vip.view',
  'report.view', 'report.resolve',
  'audit.view', 'audit.export',
  'backup.create', 'backup.restore',
  'settings.edit', 'settings.view',
  'moderation.ban', 'moderation.mute', 'moderation.kick',
  'reports.check',
  'recharge.view',
  'treasury.view', 'treasury.manage',
  'notifications.send',
  'analytics.view',
  'leaderboard.manage',
  'moments.delete',
  'rewards.inject',
  'security.block-ip',
];

staffSchema.statics.DEFAULT_PERMISSIONS = {
  owner: staffSchema.statics.ALL_PERMISSIONS,
  super_admin: ['staff.create', 'staff.edit', 'staff.view', 'user.ban', 'user.edit', 'agency.approve', 'content.edit', 'banner.upload', 'ad.manage', 'vip.manage', 'report.view', 'audit.view', 'settings.edit', 'reports.check', 'treasury.view', 'analytics.view', 'leaderboard.manage', 'moments.delete', 'rewards.inject', 'security.block-ip'],
  admin: ['staff.create', 'staff.edit', 'staff.view', 'user.ban', 'user.edit', 'withdrawal.approve', 'reports.check'],
  sub_admin: ['staff.view', 'user.view', 'report.view'],
  moderator: ['user.ban', 'user.unban', 'moderation.mute', 'moderation.kick', 'moments.delete'],
  support_staff: ['user.view', 'reports.check'],
  user_manager: ['user.view', 'user.edit', 'user.ban', 'user.unban', 'user.verify'],
  agency_manager: ['agency.view', 'agency.approve', 'agency.revoke'],
  family_manager: ['family.view', 'family.approve', 'family.delete'],
  finance_manager: ['treasury.view', 'treasury.manage', 'withdrawal.approve', 'withdrawal.reject', 'recharge.view'],
  event_manager: ['event.create', 'event.edit', 'event.delete', 'event.view'],
  cms_manager: ['content.edit', 'content.publish'],
  banner_manager: ['banner.upload', 'banner.delete', 'banner.view'],
  advertisement_manager: ['ad.manage', 'ad.view'],
  gift_manager: ['gift.create', 'gift.edit', 'gift.delete', 'gift.view'],
  vip_manager: ['vip.manage', 'vip.view'],
  audit_manager: ['audit.view', 'audit.export'],
  reports_manager: ['report.view', 'report.resolve'],
  backup_manager: ['backup.create', 'backup.restore'],
  settings_manager: ['settings.edit', 'settings.view'],
};

module.exports = mongoose.model('Staff', staffSchema);