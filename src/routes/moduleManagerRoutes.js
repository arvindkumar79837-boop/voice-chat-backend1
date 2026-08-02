// ═══════════════════════════════════════════════════════════════════════════
// ROUTES: Module Manager Routes — Unified routes for all specialized managers
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const moduleManagerController = require('../controllers/moduleManagerController');
const staffController = require('../controllers/staffController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const verifyAdmin = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Protect all module manager routes
router.use(authMiddleware);
router.use(verifyStaff);

// ===========================================================================
// DASHBOARD
// ===========================================================================

// GET /api/admin/modules/dashboard
router.get('/dashboard', validatePagination(), moduleManagerController.getManagerDashboard);

// ===========================================================================
// TERMINOLOGY & PERMISSIONS
// ===========================================================================

// GET /api/admin/modules/terminology
router.get('/terminology', validatePagination(), moduleManagerController.getTerminology);

// ===========================================================================
// USER MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/users
router.get('/users', validatePagination(), staffController.searchUser);

// PUT /api/admin/modules/users/:id/ban
router.put('/users/:id/ban', validateObjectId('id'), verifyAdmin, require('../controllers/admin.controller').toggleBan);

// PUT /api/admin/modules/users/:id/verify
router.put('/users/:id/verify', validateObjectId('id'), verifyAdmin, require('../controllers/admin.user.controller').verifyUser);

// ===========================================================================
// AGENCY MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/agencies
router.get('/agencies', validatePagination(), require('../controllers/agencyController').getAgencies);

// POST /api/admin/modules/agencies/:id/approve
router.post('/agencies/:id/approve', validateObjectId('id'), verifyAdmin, require('../controllers/agencyController').approveAgency);

// POST /api/admin/modules/agencies/:id/revoke
router.post('/agencies/:id/revoke', validateObjectId('id'), verifyAdmin, require('../controllers/agencyController').revokeAgency);

// ===========================================================================
// FAMILY MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/families
router.get('/families', validatePagination(), require('../controllers/familyController').adminGetAllFamilies);

// DELETE /api/admin/modules/families/:id
router.delete('/families/:id', verifyAdmin, require('../controllers/familyController').adminDeleteFamily);

// ===========================================================================
// FINANCE MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/finance/transactions
router.get('/finance/transactions', validatePagination(), require('../controllers/treasuryController').getCoinOrders);

// POST /api/admin/modules/finance/withdrawals/:id/approve
router.post('/finance/withdrawals/:id/approve', validateObjectId('id'), verifyAdmin, require('../controllers/admin.user.controller').approveWithdrawal);

// POST /api/admin/modules/finance/withdrawals/:id/reject
router.post('/finance/withdrawals/:id/reject', validateObjectId('id'), verifyAdmin, require('../controllers/admin.user.controller').rejectWithdrawal);

// GET /api/admin/modules/finance/wallets
router.get('/finance/wallets', validatePagination(), require('../controllers/admin.controller').getWallets);

// ===========================================================================
// EVENT MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/events
router.get('/events', validatePagination(), require('../controllers/eventController').getActiveEvents);

// POST /api/admin/modules/events
router.post('/events', verifyAdmin, require('../controllers/eventController').createEvent);

// PUT /api/admin/modules/events/:id
router.put('/events/:id', validateObjectId('id'), verifyAdmin, require('../controllers/eventController').updateEvent);

// DELETE /api/admin/modules/events/:id
router.delete('/events/:id', verifyAdmin, require('../controllers/eventController').deleteEvent);

// ===========================================================================
// BANNER MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/banners
router.get('/banners', validatePagination(), moduleManagerController.getBanners);

// POST /api/admin/modules/banners
router.post('/banners', verifyAdmin, moduleManagerController.createBanner);

// PUT /api/admin/modules/banners/:id
router.put('/banners/:id', validateObjectId('id'), verifyAdmin, moduleManagerController.updateBanner);

// DELETE /api/admin/modules/banners/:id
router.delete('/banners/:id', verifyAdmin, moduleManagerController.deleteBanner);

// ===========================================================================
// ADVERTISEMENT MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/ads
router.get('/ads', validatePagination(), moduleManagerController.getAdvertisements);

// POST /api/admin/modules/ads
router.post('/ads', verifyAdmin, moduleManagerController.createAdvertisement);

// PUT /api/admin/modules/ads/:id
router.put('/ads/:id', validateObjectId('id'), verifyAdmin, moduleManagerController.updateAdvertisement);

// DELETE /api/admin/modules/ads/:id
router.delete('/ads/:id', verifyAdmin, moduleManagerController.deleteAdvertisement);

// ===========================================================================
// GIFT MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/gifts
router.get('/gifts', validatePagination(), moduleManagerController.getGifts);

// POST /api/admin/modules/gifts
router.post('/gifts', verifyAdmin, moduleManagerController.createGift);

// PUT /api/admin/modules/gifts/:id
router.put('/gifts/:id', validateObjectId('id'), verifyAdmin, moduleManagerController.updateGift);

// DELETE /api/admin/modules/gifts/:id
router.delete('/gifts/:id', verifyAdmin, moduleManagerController.deleteGift);

// ===========================================================================
// VIP MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/vip/plans
router.get('/vip/plans', validatePagination(), moduleManagerController.getVipPlans);

// POST /api/admin/modules/vip/plans
router.post('/vip/plans', verifyAdmin, moduleManagerController.createVipPlan);

// PUT /api/admin/modules/vip/plans/:id
router.put('/vip/plans/:id', validateObjectId('id'), verifyAdmin, moduleManagerController.updateVipPlan);

// DELETE /api/admin/modules/vip/plans/:id
router.delete('/vip/plans/:id', verifyAdmin, moduleManagerController.deleteVipPlan);

// ===========================================================================
// CMS MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/cms/pages
router.get('/cms/pages', validatePagination(), moduleManagerController.getCMSPages);

// POST /api/admin/modules/cms/pages
router.post('/cms/pages', verifyAdmin, moduleManagerController.createCMSPage);

// PUT /api/admin/modules/cms/pages/:id
router.put('/cms/pages/:id', validateObjectId('id'), verifyAdmin, moduleManagerController.updateCMSPage);

// ===========================================================================
// AUDIT MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/audit-logs
router.get('/audit-logs', validatePagination(), moduleManagerController.getAuditLogs);

// GET /api/admin/modules/audit-logs/export
router.get('/audit-logs/export', validatePagination(), moduleManagerController.exportAuditLogs);

// ===========================================================================
// REPORTS MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/reports
router.get('/reports', validatePagination(), moduleManagerController.getReports);

// POST /api/admin/modules/reports/:id/assign
router.post('/reports/:id/assign', validateObjectId('id'), verifyAdmin, moduleManagerController.assignReport);

// POST /api/admin/modules/reports/:id/resolve
router.post('/reports/:id/resolve', validateObjectId('id'), verifyAdmin, moduleManagerController.resolveReport);

// ===========================================================================
// BACKUP MANAGER MODULE
// ===========================================================================

// POST /api/admin/modules/backup/create
router.post('/backup/create', verifyAdmin, moduleManagerController.createBackup);

// GET /api/admin/modules/backups
router.get('/backups', validatePagination(), moduleManagerController.getBackups);

// ===========================================================================
// SETTINGS MANAGER MODULE
// ===========================================================================

// GET /api/admin/modules/settings
router.get('/settings', validatePagination(), moduleManagerController.getSettings);

// PUT /api/admin/modules/settings
router.put('/settings', verifyAdmin, moduleManagerController.updateSettings);

module.exports = router;