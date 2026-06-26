// ═══════════════════════════════════════════════════════════════════════════
// ROUTES: Module Manager Routes — Unified routes for all specialized managers
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const moduleManagerController = require('../controllers/moduleManagerController');
const staffController = require('../controllers/staffController');
const authMiddleware = require('../middlewares/auth.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const verifyAdmin = require('../middlewares/isAdmin');

// Protect all module manager routes
router.use(authMiddleware);
router.use(verifyStaff);

// ===========================================================================
// DASHBOARD
// ===========================================================================

// GET /api/admin/modules/dashboard
router.get('/dashboard', moduleManagerController.getManagerDashboard);

// ===========================================================================
// TERMINOLOGY & PERMISSIONS
// ===========================================================================

// GET /api/admin/modules/terminology
router.get('/terminology', moduleManagerController.getTerminology);

// ===========================================================================
// USER MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/users
router.get('/users', staffController.searchUser);

// PUT /api/admin/modules/users/:id/ban
router.put('/users/:id/ban', verifyAdmin, require('../controllers/admin.controller').toggleBan);

// PUT /api/admin/modules/users/:id/verify
router.put('/users/:id/verify', verifyAdmin, require('../controllers/admin.user.controller').verifyUser);

// ===========================================================================
// AGENCY MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/agencies
router.get('/agencies', require('../controllers/agencyController').getAgencies);

// POST /api/admin/modules/agencies/:id/approve
router.post('/agencies/:id/approve', verifyAdmin, require('../controllers/agencyController').approveAgency);

// POST /api/admin/modules/agencies/:id/revoke
router.post('/agencies/:id/revoke', verifyAdmin, require('../controllers/agencyController').revokeAgency);

// ===========================================================================
// FAMILY MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/families
router.get('/families', require('../controllers/familyController').getFamilies);

// DELETE /api/admin/modules/families/:id
router.delete('/families/:id', verifyAdmin, require('../controllers/familyController').deleteFamily);

// ===========================================================================
// FINANCE MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/finance/transactions
router.get('/finance/transactions', require('../controllers/treasuryController').getCoinOrders);

// POST /api/admin/modules/finance/withdrawals/:id/approve
router.post('/finance/withdrawals/:id/approve', verifyAdmin, require('../controllers/admin.user.controller').approveWithdrawal);

// POST /api/admin/modules/finance/withdrawals/:id/reject
router.post('/finance/withdrawals/:id/reject', verifyAdmin, require('../controllers/admin.user.controller').rejectWithdrawal);

// GET /api/admin/modules/finance/wallets
router.get('/finance/wallets', require('../controllers/admin.controller').getWallets);

// ===========================================================================
// EVENT MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/events
router.get('/events', require('../controllers/eventController').getAdminEvents);

// POST /api/admin/modules/events
router.post('/events', verifyAdmin, require('../controllers/eventController').createEvent);

// PUT /api/admin/modules/events/:id
router.put('/events/:id', verifyAdmin, require('../controllers/eventController').updateEvent);

// DELETE /api/admin/modules/events/:id
router.delete('/events/:id', verifyAdmin, require('../controllers/eventController').deleteEvent);

// ===========================================================================
// BANNER MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/banners
router.get('/banners', moduleManagerController.getBanners);

// POST /api/admin/modules/banners
router.post('/banners', verifyAdmin, moduleManagerController.createBanner);

// PUT /api/admin/modules/banners/:id
router.put('/banners/:id', verifyAdmin, moduleManagerController.updateBanner);

// DELETE /api/admin/modules/banners/:id
router.delete('/banners/:id', verifyAdmin, moduleManagerController.deleteBanner);

// ===========================================================================
// ADVERTISEMENT MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/ads
router.get('/ads', moduleManagerController.getAdvertisements);

// POST /api/admin/modules/ads
router.post('/ads', verifyAdmin, moduleManagerController.createAdvertisement);

// PUT /api/admin/modules/ads/:id
router.put('/ads/:id', verifyAdmin, moduleManagerController.updateAdvertisement);

// DELETE /api/admin/modules/ads/:id
router.delete('/ads/:id', verifyAdmin, moduleManagerController.deleteAdvertisement);

// ===========================================================================
// GIFT MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/gifts
router.get('/gifts', moduleManagerController.getGifts);

// POST /api/admin/modules/gifts
router.post('/gifts', verifyAdmin, moduleManagerController.createGift);

// PUT /api/admin/modules/gifts/:id
router.put('/gifts/:id', verifyAdmin, moduleManagerController.updateGift);

// DELETE /api/admin/modules/gifts/:id
router.delete('/gifts/:id', verifyAdmin, moduleManagerController.deleteGift);

// ===========================================================================
// VIP MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/vip/plans
router.get('/vip/plans', moduleManagerController.getVipPlans);

// POST /api/admin/modules/vip/plans
router.post('/vip/plans', verifyAdmin, moduleManagerController.createVipPlan);

// PUT /api/admin/modules/vip/plans/:id
router.put('/vip/plans/:id', verifyAdmin, moduleManagerController.updateVipPlan);

// DELETE /api/admin/modules/vip/plans/:id
router.delete('/vip/plans/:id', verifyAdmin, moduleManagerController.deleteVipPlan);

// ===========================================================================
// CMS MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/cms/pages
router.get('/cms/pages', moduleManagerController.getCMSPages);

// POST /api/admin/modules/cms/pages
router.post('/cms/pages', verifyAdmin, moduleManagerController.createCMSPage);

// PUT /api/admin/modules/cms/pages/:id
router.put('/cms/pages/:id', verifyAdmin, moduleManagerController.updateCMSPage);

// ===========================================================================
// AUDIT MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/audit-logs
router.get('/audit-logs', moduleManagerController.getAuditLogs);

// GET /api/admin/modules/audit-logs/export
router.get('/audit-logs/export', moduleManagerController.exportAuditLogs);

// ===========================================================================
// REPORTS MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/reports
router.get('/reports', moduleManagerController.getReports);

// POST /api/admin/modules/reports/:id/assign
router.post('/reports/:id/assign', verifyAdmin, moduleManagerController.assignReport);

// POST /api/admin/modules/reports/:id/resolve
router.post('/reports/:id/resolve', verifyAdmin, moduleManagerController.resolveReport);

// ===========================================================================
// BACKUP MANAGER MODULE
// ===========================================================================

// POST /api/admin/modules/backup/create
router.post('/backup/create', verifyAdmin, moduleManagerController.createBackup);

// GET /api/admin/modules/backups
router.get('/backups', moduleManagerController.getBackups);

// ===========================================================================
// SETTINGS MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/settings
router.get('/settings', moduleManagerController.getSettings);

// PUT /api/admin/modules/settings
router.put('/settings', verifyAdmin, moduleManagerController.updateSettings);

module.exports = router;