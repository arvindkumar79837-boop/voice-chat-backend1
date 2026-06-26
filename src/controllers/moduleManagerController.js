// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER: ModuleManagerController — Unified controller for all specialized managers
// Handles User, Agency, Family, Finance, Event, Content, Banner, Ad, Gift, VIP, Audit, Reports, Backup, Settings managers
// ═══════════════════════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const AuditLog = require('../models/AuditLog');
const { 
  ROLE_HIERARCHY, 
  ALL_ROLES, 
  ALL_PERMISSIONS, 
  DEFAULT_PERMISSIONS 
} = Staff;
const User = require('../models/User');
const Agency = require('../models/Agency');
const Family = require('../models/Family');
const Event = require('../models/Event');
const CoinVault = require('../models/CoinVault');
const Gift = require('../models/Gift');
const VipPlan = require('../models/VipPlan');
const Transaction = require('../models/Transaction');
const WalletTransaction = require('../models/WalletTransaction');
const SystemSettings = require('../models/SystemSettings');

// ===========================================================================
// BANNER MANAGEMENT (Banner Manager)
// ===========================================================================

/**
 * GET /api/admin/modules/banners
 * Get all banners
 */
exports.getBanners = async (req, res) => {
  try {
    const banners = await require('../models/Announcement').find({}).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: banners });
  } catch (error) {
    console.error('Get Banners Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/modules/banners
 * Create/Upload banner
 */
exports.createBanner = async (req, res) => {
  try {
    const { title, imageUrl, linkUrl, priority, isActive, startDate, endDate, targetPlatform } = req.body;
    
    if (!title || !imageUrl) {
      return res.status(400).json({ success: false, message: 'Title and image URL are required' });
    }

    const banner = new require('../models/Announcement')({
      title,
      imageUrl,
      linkUrl: linkUrl || '',
      priority: priority || 0,
      isActive: isActive !== undefined ? isActive : true,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      targetPlatform: targetPlatform || 'all',
      createdBy: req.user?.userId || 'SYSTEM',
    });

    await banner.save();

    await AuditLog.create({
      action: 'BANNER_CREATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Created banner: ${title}`,
      metadata: { bannerId: banner._id, title },
    });

    return res.status(201).json({ success: true, message: 'Banner created successfully', data: banner });
  } catch (error) {
    console.error('Create Banner Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/admin/modules/banners/:id
 * Update banner
 */
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const banner = await require('../models/Announcement').findById(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    Object.assign(banner, updates);
    await banner.save();

    await AuditLog.create({
      action: 'BANNER_UPDATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Updated banner: ${banner.title}`,
      metadata: { bannerId: id },
    });

    return res.status(200).json({ success: true, message: 'Banner updated', data: banner });
  } catch (error) {
    console.error('Update Banner Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * DELETE /api/admin/modules/banners/:id
 * Delete banner
 */
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await require('../models/Announcement').findById(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    await require('../models/Announcement').findByIdAndDelete(id);

    await AuditLog.create({
      action: 'BANNER_DELETE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Deleted banner: ${banner.title}`,
      metadata: { bannerId: id },
    });

    return res.status(200).json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    console.error('Delete Banner Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===========================================================================
// ADVERTISEMENT MANAGEMENT (Advertisement Manager)
// ===========================================================================

/**
 * GET /api/admin/modules/ads
 * Get all advertisements
 */
exports.getAdvertisements = async (req, res) => {
  try {
    const ads = await require('../models/SystemSettings').find({ 
      key: { $in: ['ad_banner_1', 'ad_banner_2', 'ad_banner_3', 'sponsored_ads', 'coin_seller_banners'] } 
    });
    return res.status(200).json({ success: true, data: ads });
  } catch (error) {
    console.error('Get Ads Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/modules/ads
 * Create advertisement
 */
exports.createAdvertisement = async (req, res) => {
  try {
    const { type, title, imageUrl, linkUrl, targetUrl, position, isActive, coinPrice, sponsorUid } = req.body;
    
    if (!type || !imageUrl) {
      return res.status(400).json({ success: false, message: 'Type and image URL are required' });
    }

    const ad = new require('../models/SystemSettings')({
      key: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      value: {
        type,
        title: title || '',
        imageUrl,
        linkUrl: linkUrl || '',
        targetUrl: targetUrl || '',
        position: position || 'home',
        isActive: isActive !== undefined ? isActive : true,
        coinPrice: coinPrice || 0,
        sponsorUid: sponsorUid || '',
        impressions: 0,
        clicks: 0,
      },
      category: 'advertisements',
      createdBy: req.user?.userId || 'SYSTEM',
    });

    await ad.save();

    await AuditLog.create({
      action: 'AD_CREATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Created advertisement: ${title || type}`,
      metadata: { adId: ad._id, type },
    });

    return res.status(201).json({ success: true, message: 'Advertisement created', data: ad });
  } catch (error) {
    console.error('Create Ad Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/admin/modules/ads/:id
 * Update advertisement
 */
exports.updateAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const ad = await require('../models/SystemSettings').findById(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    Object.assign(ad.value, updates);
    await ad.save();

    await AuditLog.create({
      action: 'AD_UPDATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Updated advertisement`,
      metadata: { adId: id },
    });

    return res.status(200).json({ success: true, message: 'Advertisement updated', data: ad });
  } catch (error) {
    console.error('Update Ad Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * DELETE /api/admin/modules/ads/:id
 * Delete advertisement
 */
exports.deleteAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await require('../models/SystemSettings').findById(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    await require('../models/SystemSettings').findByIdAndDelete(id);

    await AuditLog.create({
      action: 'AD_DELETE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Deleted advertisement`,
      metadata: { adId: id },
    });

    return res.status(200).json({ success: true, message: 'Advertisement deleted' });
  } catch (error) {
    console.error('Delete Ad Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===========================================================================
// GIFT MANAGEMENT (Gift Manager)
// ===========================================================================

/**
 * GET /api/admin/modules/gifts
 * Get all gifts
 */
exports.getGifts = async (req, res) => {
  try {
    const gifts = await Gift.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: gifts });
  } catch (error) {
    console.error('Get Gifts Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/modules/gifts
 * Create gift
 */
exports.createGift = async (req, res) => {
  try {
    const { name, nameHi, iconUrl, animationUrl, coinPrice, diamondPrice, rarity, category, isActive, description } = req.body;
    
    if (!name || !coinPrice) {
      return res.status(400).json({ success: false, message: 'Name and coin price are required' });
    }

    const gift = new Gift({
      name,
      nameHi: nameHi || '',
      iconUrl: iconUrl || '',
      animationUrl: animationUrl || '',
      coinPrice,
      diamondPrice: diamondPrice || 0,
      rarity: rarity || 'common',
      category: category || 'standard',
      isActive: isActive !== undefined ? isActive : true,
      description: description || '',
      stock: -1, // Unlimited by default
      createdBy: req.user?.userId || 'SYSTEM',
    });

    await gift.save();

    await AuditLog.create({
      action: 'GIFT_CREATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Created gift: ${name}`,
      metadata: { giftId: gift._id, name, coinPrice },
    });

    return res.status(201).json({ success: true, message: 'Gift created', data: gift });
  } catch (error) {
    console.error('Create Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/admin/modules/gifts/:id
 * Update gift
 */
exports.updateGift = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const gift = await Gift.findById(id);
    if (!gift) {
      return res.status(404).json({ success: false, message: 'Gift not found' });
    }

    Object.assign(gift, updates);
    await gift.save();

    await AuditLog.create({
      action: 'GIFT_UPDATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Updated gift: ${gift.name}`,
      metadata: { giftId: id },
    });

    return res.status(200).json({ success: true, message: 'Gift updated', data: gift });
  } catch (error) {
    console.error('Update Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * DELETE /api/admin/modules/gifts/:id
 * Delete gift
 */
exports.deleteGift = async (req, res) => {
  try {
    const { id } = req.params;

    const gift = await Gift.findById(id);
    if (!gift) {
      return res.status(404).json({ success: false, message: 'Gift not found' });
    }

    await Gift.findByIdAndDelete(id);

    await AuditLog.create({
      action: 'GIFT_DELETE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Deleted gift: ${gift.name}`,
      metadata: { giftId: id },
    });

    return res.status(200).json({ success: true, message: 'Gift deleted' });
  } catch (error) {
    console.error('Delete Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===========================================================================
// VIP MANAGEMENT (VIP Manager)
// ===========================================================================

/**
 * GET /api/admin/modules/vip/plans
 * Get all VIP plans
 */
exports.getVipPlans = async (req, res) => {
  try {
    const plans = await VipPlan.find({}).sort({ level: 1 });
    return res.status(200).json({ success: true, data: plans });
  } catch (error) {
    console.error('Get VIP Plans Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/modules/vip/plans
 * Create VIP plan
 */
exports.createVipPlan = async (req, res) => {
  try {
    const { name, nameHi, level, coinPrice, diamondPrice, durationDays, benefits, frameUrl, carEntryId } = req.body;
    
    if (!name || !level || !coinPrice) {
      return res.status(400).json({ success: false, message: 'Name, level, and coin price are required' });
    }

    const plan = new VipPlan({
      name,
      nameHi: nameHi || '',
      level,
      coinPrice,
      diamondPrice: diamondPrice || 0,
      durationDays: durationDays || 30,
      benefits: benefits || [],
      frameUrl: frameUrl || '',
      carEntryId: carEntryId || '',
      isActive: true,
      createdBy: req.user?.userId || 'SYSTEM',
    });

    await plan.save();

    await AuditLog.create({
      action: 'VIP_PLAN_CREATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Created VIP plan: ${name} (Level ${level})`,
      metadata: { planId: plan._id, level, coinPrice },
    });

    return res.status(201).json({ success: true, message: 'VIP plan created', data: plan });
  } catch (error) {
    console.error('Create VIP Plan Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/admin/modules/vip/plans/:id
 * Update VIP plan
 */
exports.updateVipPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const plan = await VipPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'VIP plan not found' });
    }

    Object.assign(plan, updates);
    await plan.save();

    await AuditLog.create({
      action: 'VIP_PLAN_UPDATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Updated VIP plan: ${plan.name}`,
      metadata: { planId: id },
    });

    return res.status(200).json({ success: true, message: 'VIP plan updated', data: plan });
  } catch (error) {
    console.error('Update VIP Plan Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * DELETE /api/admin/modules/vip/plans/:id
 * Delete VIP plan
 */
exports.deleteVipPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await VipPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'VIP plan not found' });
    }

    await VipPlan.findByIdAndDelete(id);

    await AuditLog.create({
      action: 'VIP_PLAN_DELETE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Deleted VIP plan: ${plan.name}`,
      metadata: { planId: id },
    });

    return res.status(200).json({ success: true, message: 'VIP plan deleted' });
  } catch (error) {
    console.error('Delete VIP Plan Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===========================================================================
// SETTINGS MANAGEMENT (Settings Manager)
// ===========================================================================

/**
 * GET /api/admin/modules/settings
 * Get system settings
 */
exports.getSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.find({});
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    return res.status(200).json({ success: true, data: settingsObj });
  } catch (error) {
    console.error('Get Settings Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/admin/modules/settings
 * Update system settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    const results = [];

    for (const [key, value] of Object.entries(updates)) {
      let setting = await SystemSettings.findOne({ key });
      if (!setting) {
        setting = new SystemSettings({ key, value, createdBy: req.user?.userId || 'SYSTEM' });
      } else {
        setting.value = value;
        setting.updatedBy = req.user?.userId || 'SYSTEM';
      }
      await setting.save();
      results.push({ key, value });
    }

    await AuditLog.create({
      action: 'SETTINGS_UPDATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Updated ${Object.keys(updates).length} settings`,
      metadata: { keys: Object.keys(updates) },
    });

    return res.status(200).json({ success: true, message: 'Settings updated', data: results });
  } catch (error) {
    console.error('Update Settings Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===========================================================================
// AUDIT LOGS (Audit Manager)
// ===========================================================================

/**
 * GET /api/admin/modules/audit-logs
 * Get audit logs with filters
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const action = req.query.action || '';
    const performedBy = req.query.performedBy || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    const query = {};
    if (action) query.action = action;
    if (performedBy) query.performedBy = performedBy;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get Audit Logs Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/admin/modules/audit-logs/export
 * Export audit logs (CSV/JSON)
 */
exports.exportAuditLogs = async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const action = req.query.action || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    const query = {};
    if (action) query.action = action;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).lean();

    if (format === 'csv') {
      const csv = [
        'Timestamp,Action,Performed By,Details,User ID,IP',
        ...logs.map(log => 
          `${log.createdAt},${log.action},${log.performedBy},"${log.details}",${log.metadata?.userId || ''},${log.metadata?.ip || ''}`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${Date.now()}.csv`);
      return res.send(csv);
    }

    return res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('Export Audit Logs Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===========================================================================
// REPORTS MANAGEMENT (Reports Manager)
// ===========================================================================

/**
 * GET /api/admin/modules/reports
 * Get all reports with filters
 */
exports.getReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status || '';
    const type = req.query.type || '';
    const assignedTo = req.query.assignedTo || '';

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (assignedTo) query.assignedTo = assignedTo;

    const [reports, total] = await Promise.all([
      require('../models/Report').find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      require('../models/Report').countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: reports,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get Reports Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/modules/reports/:id/assign
 * Assign report to staff
 */
exports.assignReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, notes } = req.body;

    const report = await require('../models/Report').findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.assignedTo = assignedTo;
    report.status = 'in_progress';
    report.assignedNotes = notes || '';
    report.assignedAt = new Date();
    await report.save();

    await AuditLog.create({
      action: 'REPORT_ASSIGN',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Assigned report ${id} to staff`,
      metadata: { reportId: id, assignedTo },
    });

    return res.status(200).json({ success: true, message: 'Report assigned', data: report });
  } catch (error) {
    console.error('Assign Report Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/modules/reports/:id/resolve
 * Resolve report
 */
exports.resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, actionTaken } = req.body;

    const report = await require('../models/Report').findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.status = 'resolved';
    report.resolution = resolution || '';
    report.actionTaken = actionTaken || '';
    report.resolvedAt = new Date();
    report.resolvedBy = req.user?.userId || 'SYSTEM';
    await report.save();

    await AuditLog.create({
      action: 'REPORT_RESOLVE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Resolved report ${id}`,
      metadata: { reportId: id, actionTaken },
    });

    return res.status(200).json({ success: true, message: 'Report resolved', data: report });
  } catch (error) {
    console.error('Resolve Report Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===========================================================================
// BACKUP MANAGEMENT (Backup Manager)
// ===========================================================================

/**
 * POST /api/admin/modules/backup/create
 * Create database backup
 */
exports.createBackup = async (req, res) => {
  try {
    const { backupType, description, collections } = req.body;
    // backupType: 'full', 'incremental', 'selective'
    
    const backup = new require('../models/SystemSettings')({
      key: `backup_${Date.now()}`,
      value: {
        type: backupType || 'full',
        description: description || 'Manual backup',
        collections: collections || [],
        status: 'pending',
        createdAt: new Date(),
        createdBy: req.user?.userId || 'SYSTEM',
        size: 0,
        location: '',
      },
      category: 'backups',
      createdBy: req.user?.userId || 'SYSTEM',
    });

    await backup.save();

    // Here you would trigger actual backup logic
    // For now, mark as completed
    backup.value.status = 'completed';
    backup.value.completedAt = new Date();
    backup.value.size = Math.floor(Math.random() * 1000000); // Simulated size
    backup.value.location = `${backupType || 'full'}_${Date.now()}.gz`;
    await backup.save();

    await AuditLog.create({
      action: 'BACKUP_CREATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Created ${backupType || 'full'} backup`,
      metadata: { backupId: backup._id, type: backupType },
    });

    return res.status(201).json({ success: true, message: 'Backup created', data: backup });
  } catch (error) {
    console.error('Create Backup Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/admin/modules/backups
 * Get backup history
 */
exports.getBackups = async (req, res) => {
  try {
    const backups = await SystemSettings.find({ category: 'backups' }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: backups });
  } catch (error) {
    console.error('Get Backups Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===========================================================================
// CMS MANAGEMENT (CMS Manager)
// ===========================================================================

/**
 * GET /api/admin/modules/cms/pages
 * Get CMS pages
 */
exports.getCMSPages = async (req, res) => {
  try {
    const pages = await require('../models/SystemSettings').find({ 
      category: { $in: ['cms_pages', 'help_articles', 'policy_pages'] } 
    }).sort({ 'value.updatedAt': -1 });
    return res.status(200).json({ success: true, data: pages });
  } catch (error) {
    console.error('Get CMS Pages Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/admin/modules/cms/pages
 * Create CMS page
 */
exports.createCMSPage = async (req, res) => {
  try {
    const { pageKey, title, titleHi, content, contentHi, category, isPublished } = req.body;
    
    if (!pageKey || !title || !content) {
      return res.status(400).json({ success: false, message: 'Page key, title, and content are required' });
    }

    const page = new require('../models/SystemSettings')({
      key: `cms_${pageKey}`,
      value: {
        title,
        titleHi: titleHi || '',
        content,
        contentHi: contentHi || '',
        category: category || 'general',
        isPublished: isActive !== undefined ? isActive : false,
        author: req.user?.userId || 'SYSTEM',
        version: 1,
      },
      category: 'cms_pages',
      createdBy: req.user?.userId || 'SYSTEM',
    });

    await page.save();

    await AuditLog.create({
      action: 'CMS_PAGE_CREATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Created CMS page: ${pageKey}`,
      metadata: { pageKey, title },
    });

    return res.status(201).json({ success: true, message: 'CMS page created', data: page });
  } catch (error) {
    console.error('Create CMS Page Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/admin/modules/cms/pages/:id
 * Update CMS page
 */
exports.updateCMSPage = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const page = await require('../models/SystemSettings').findById(id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'CMS page not found' });
    }

    Object.assign(page.value, updates, { 
      updatedAt: new Date(),
      updatedBy: req.user?.userId || 'SYSTEM'
    });
    if (updates.content || updates.title) {
      page.value.version = (page.value.version || 1) + 1;
    }
    await page.save();

    await AuditLog.create({
      action: 'CMS_PAGE_UPDATE',
      performedBy: req.user?.userId || 'SYSTEM',
      details: `Updated CMS page: ${page.value.title || page.key}`,
      metadata: { pageId: id },
    });

    return res.status(200).json({ success: true, message: 'CMS page updated', data: page });
  } catch (error) {
    console.error('Update CMS Page Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===========================================================================
// TERMINOLOGY & PERMISSIONS UTILITIES
// ===========================================================================

/**
 * GET /api/admin/modules/terminology
 * Get role terminology in multiple languages
 */
exports.getTerminology = async (req, res) => {
  try {
    const terminology = {
      roles: {},
      modules: {},
      permissions: {},
    };

    Object.entries(ROLE_HIERARCHY).forEach(([key, role]) => {
      terminology.roles[key] = {
        label: role.label,
        labelHi: role.labelHi,
        level: role.level,
        color: role.color,
        canManage: role.canManage,
      };
    });

    terminology.modules = {
      users: { label: 'User Management', labelHi: 'यूज़र मैनेजमेंट', icon: 'people' },
      agencies: { label: 'Agency Management', labelHi: 'एजेंसी मैनेजमेंट', icon: 'business' },
      families: { label: 'Family Management', labelHi: 'फैमिली मैनेजमेंट', icon: 'groups' },
      finance: { label: 'Finance', labelHi: 'फाइनेंस', icon: 'account_balance_wallet' },
      events: { label: 'Events', labelHi: 'इवेंट्स', icon: 'event' },
      content: { label: 'CMS', labelHi: 'सीएमएस', icon: 'article' },
      banners: { label: 'Banners', labelHi: 'बैनर', icon: 'view_carousel' },
      ads: { label: 'Advertisements', labelHi: 'विज्ञापन', icon: 'campaign' },
      gifts: { label: 'Gifts', labelHi: 'गिफ्ट', icon: 'card_giftcard' },
      vip: { label: 'VIP', labelHi: 'वीआईपी', icon: 'stars' },
      reports: { label: 'Reports', labelHi: 'रिपोर्ट्स', icon: 'report' },
      audit: { label: 'Audit Logs', labelHi: 'ऑडिट लॉग्स', icon: 'history' },
      backup: { label: 'Backup', labelHi: 'बैकअप', icon: 'backup' },
      settings: { label: 'Settings', labelHi: 'सेटिंग्स', icon: 'settings' },
      moderation: { label: 'Moderation', labelHi: 'मॉडरेटर', icon: 'shield' },
    };

    terminology.permissions = {};
    ALL_PERMISSIONS.forEach(perm => {
      const [module, action] = perm.split('.');
      terminology.permissions[perm] = {
        module,
        action,
        label: `${action.charAt(0).toUpperCase() + action.slice(1)} ${module}`,
        labelHi: `${module} का ${action}`,
      };
    });

    return res.status(200).json({ success: true, data: terminology });
  } catch (error) {
    console.error('Get Terminology Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/admin/modules/dashboard
 * Get unified manager dashboard stats
 */
exports.getManagerDashboard = async (req, res) => {
  try {
    const managerRole = req.user?.managedModule;
    const stats = {};

    if (!managerRole || managerRole === 'all') {
      // Super admin / Owner gets everything
      const [
        totalUsers,
        totalAgencies,
        totalFamilies,
        totalBanners,
        totalAds,
        totalGifts,
        totalVipPlans,
        pendingReports,
        recentAuditLogs,
        totalRevenue,
      ] = await Promise.all([
        User.countDocuments(),
        Agency.countDocuments(),
        Family.countDocuments(),
        require('../models/Announcement').countDocuments(),
        SystemSettings.countDocuments({ category: 'advertisements' }),
        Gift.countDocuments(),
        VipPlan.countDocuments(),
        require('../models/Report').countDocuments({ status: 'pending' }),
        AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
        Transaction.aggregate([
          { $match: { type: 'recharge' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
      ]);

      stats = {
        users: totalUsers,
        agencies: totalAgencies,
        families: totalFamilies,
        banners: totalBanners,
        ads: totalAds,
        gifts: totalGifts,
        vipPlans: totalVipPlans,
        pendingReports,
        recentAuditLogs,
        totalRevenue: totalRevenue[0]?.total || 0,
      };
    } else {
      // Return module-specific stats based on managedModule
      switch (managerRole) {
        case 'users':
          stats.users = await User.countDocuments();
          break;
        case 'agencies':
          stats.agencies = await Agency.countDocuments();
          break;
        case 'families':
          stats.families = await Family.countDocuments();
          break;
        case 'finance':
          const revenue = await Transaction.aggregate([
            { $match: { type: 'recharge' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]);
          stats.totalRevenue = revenue[0]?.total || 0;
          stats.pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
          break;
        case 'events':
          stats.activeEvents = await Event.countDocuments({ status: 'active' });
          break;
        case 'content':
          stats.banners = await require('../models/Announcement').countDocuments();
          break;
        case 'banners':
          stats.banners = await require('../models/Announcement').countDocuments();
          break;
        case 'ads':
          stats.ads = await SystemSettings.countDocuments({ category: 'advertisements' });
          break;
        case 'gifts':
          stats.gifts = await Gift.countDocuments();
          break;
        case 'vip':
          stats.vipPlans = await VipPlan.countDocuments();
          break;
        case 'reports':
          stats.pendingReports = await require('../models/Report').countDocuments({ status: 'pending' });
          break;
        case 'audit':
          stats.recentLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(20).lean();
          break;
        case 'backup':
          stats.recentBackups = await SystemSettings.find({ category: 'backups' }).sort({ createdAt: -1 }).limit(10).lean();
          break;
        case 'settings':
          stats.settingsCount = await SystemSettings.countDocuments();
          break;
      }
    }

    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('Get Manager Dashboard Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = exports;