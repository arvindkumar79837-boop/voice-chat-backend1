const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/admin.user.controller');
const adminController = require('../controllers/admin.controller');
const treasuryController = require('../controllers/treasuryController');
const rankController = require('../controllers/rankingController');
const eventController = require('../controllers/eventController');
const momentController = require('../controllers/momentController');
const notificationController = require('../controllers/notificationController');
const reportController = require('../controllers/reportController');
const staffController = require('../controllers/staffController');
const vipController = require('../controllers/vipController');
const agencyController = require('../controllers/agencyController');
const familyController = require('../controllers/familyController');
const supportController = require('../controllers/supportController');
const authMiddleware = require('../middlewares/auth.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const { verifyAdmin: isAdmin } = require('../middlewares/isAdmin');

// Protect all admin routes
router.use(authMiddleware);
router.use(verifyStaff);

// ===========================================================================
// DASHBOARD
// ===========================================================================

// GET /api/admin/stats
router.get('/stats', adminController.getStats);

// GET /api/admin/dashboard/activity
router.get('/dashboard/activity', adminController.getLiveRooms);

// GET /api/admin/rooms/live
router.get('/rooms/live', adminController.getLiveRooms);

// ===========================================================================
// USER MANAGEMENT
// ===========================================================================

// GET /api/admin/users
router.get('/users', adminController.getUsers);

// POST /api/admin/users/search-user
router.post('/search-user', staffController.searchUser);

// GET /api/admin/users/:id
router.get('/users/:id', adminController.getUserDetail);

// PUT /api/admin/users/:id
router.put('/users/:id', adminController.updateUser);

// POST /api/admin/users/block/:userId
router.post('/users/block/:userId', adminController.toggleBan);

// POST /api/admin/users/unblock/:userId
router.post('/users/unblock/:userId', adminController.toggleBan);

// PUT /api/admin/users/verify/:userId
router.put('/users/verify/:userId', adminUserController.verifyUser);

// POST /api/admin/users/adjust-coins/:userId
router.post('/users/adjust-coins/:userId', adminUserController.adjustUserCoins);

// POST /api/admin/users/balance/:userId
router.post('/users/balance/:userId', adminUserController.adjustUserCoins);

// ===========================================================================
// WALLET MANAGEMENT
// ===========================================================================

// GET /api/admin/wallets
router.get('/wallets', adminController.getWallets);

// POST /api/admin/wallets/adjust/:userId
router.post('/wallets/adjust/:userId', adminController.adjustWallet);

// ===========================================================================
// WITHDRAWALS
// ===========================================================================

// GET /api/admin/withdrawals/pending
router.get('/withdrawals/pending', adminUserController.getWithdrawals);

// POST /api/admin/withdrawals/approve/:id
router.post('/withdrawals/approve/:id', adminUserController.approveWithdrawal);

// POST /api/admin/withdrawals/reject/:id
router.post('/withdrawals/reject/:id', adminUserController.rejectWithdrawal);

// ===========================================================================
// ANNOUNCEMENTS
// ===========================================================================

// GET /api/admin/announcements
router.get('/announcements', adminUserController.getAnnouncements);

// POST /api/admin/announcement
router.post('/announcement', adminUserController.sendAnnouncement);

// ===========================================================================
// STAFF / ADMIN MANAGEMENT
// ===========================================================================

// GET /api/admin/staff/list
router.get('/staff/list', staffController.getStaffList);

// POST /api/admin/staff/create
router.post('/staff/create', verifyAdmin, staffController.createStaff);

// PUT /api/admin/staff/update/:id
router.put('/staff/update/:id', verifyAdmin, staffController.updateStaff);

// DELETE /api/admin/staff/delete/:id
router.delete('/staff/delete/:id', verifyAdmin, staffController.deleteStaff);

// GET /api/admin/roles
router.get('/roles', staffController.getAdminRoles);

// POST /api/admin/roles/create
router.post('/roles/create', isAdmin, staffController.createAdminRole);

// PUT /api/admin/roles/update/:id
router.put('/roles/update/:id', isAdmin, staffController.updateAdminRole);

// ===========================================================================
// SETTINGS
// ===========================================================================

// GET /api/admin/settings
router.get('/settings', adminController.getSettings);

// PUT /api/admin/settings
router.put('/settings', verifyAdmin, adminController.updateSettings);

// ===========================================================================
// COINS & TREASURY
// ===========================================================================

// POST /api/admin/coins/generate
router.post('/coins/generate', verifyAdmin, treasuryController.generateCoins);

// POST /api/admin/coins/deduct
router.post('/coins/deduct', verifyAdmin, treasuryController.deductCoins);

// GET /api/admin/coin-orders
router.get('/coin-orders', treasuryController.getCoinOrders);

// ===========================================================================
// REWARDS
// ===========================================================================

// POST /api/admin/rewards/send
router.post('/rewards/send', verifyAdmin, treasuryController.sendReward);

// ===========================================================================
// VIP MANAGEMENT 
// ===========================================================================

// GET /api/admin/vip/plans
router.get('/vip/plans', vipController.getVipPlans);

// POST /api/admin/vip/plans/create
router.post('/vip/plans/create', verifyAdmin, vipController.createVipPlan);

// PUT /api/admin/vip/plans/update/:id
router.put('/vip/plans/update/:id', verifyAdmin, vipController.updateVipPlan);

// ===========================================================================
// AGENCY MANAGEMENT
// ===========================================================================

// GET /api/admin/agencies
router.get('/agencies', agencyController.getAgencies);

// POST /api/admin/agencies/approve/:id
router.post('/agencies/approve/:id', verifyAdmin, agencyController.approveAgency);

// POST /api/admin/agencies/revoke/:id
router.post('/agencies/revoke/:id', verifyAdmin, agencyController.revokeAgency);

// ===========================================================================
// FAMILY MANAGEMENT
// ===========================================================================

// GET /api/admin/families
router.get('/families', familyController.getFamilies);

// DELETE /api/admin/families/:id
router.delete('/families/:id', verifyAdmin, familyController.deleteFamily);

// ===========================================================================
// EVENTS
// ===========================================================================

// GET /api/admin/events
router.get('/events', eventController.getAdminEvents);

// POST /api/admin/events
router.post('/events', verifyAdmin, eventController.createEvent);

// PUT /api/admin/events/:id
router.put('/events/:id', verifyAdmin, eventController.updateEvent);

// DELETE /api/admin/events/:id
router.delete('/events/:id', verifyAdmin, eventController.deleteEvent);

// ===========================================================================
// REPORTS
// ===========================================================================

// GET /api/admin/reports
router.get('/reports', reportController.getReports);

// POST /api/admin/reports/resolve/:id
router.post('/reports/resolve/:id', verifyAdmin, reportController.resolveReport);

// DELETE /api/admin/reports/:id
router.delete('/reports/:id', verifyAdmin, reportController.resolveReport);

// ===========================================================================
// BANS
// ===========================================================================

// GET /api/admin/bans
router.get('/bans', adminController.getBans);

// POST /api/admin/bans
router.post('/bans', verifyAdmin, adminController.createBan);

// DELETE /api/admin/bans/:id
router.delete('/bans/:id', verifyAdmin, adminController.liftBan);

// ===========================================================================
// NOTIFICATIONS
// ===========================================================================

// POST /api/admin/notifications/send
router.post('/notifications/send', verifyAdmin, notificationController.sendNotification);

// GET /api/admin/notifications/history
router.get('/notifications/history', notificationController.getNotificationHistory);

// ===========================================================================
// AUDIT LOGS
// ===========================================================================

// GET /api/admin/audit-logs
router.get('/audit-logs', staffController.getAuditLogs);

// ===========================================================================
// LEADERBOARD
// ===========================================================================

// GET /api/admin/leaderboard
router.get('/leaderboard', rankController.getAdminLeaderboard);

// POST /api/admin/leaderboard/reset
router.post('/leaderboard/reset', verifyAdmin, rankController.resetLeaderboard);

// ===========================================================================
// SUPPORT TICKETS
// ===========================================================================

// GET /api/admin/support/tickets
router.get('/support/tickets', supportController.getTickets);

// POST /api/admin/support/tickets/reply/:id
router.post('/support/tickets/reply/:id', verifyAdmin, supportController.replyToTicket);

// ===========================================================================
// GIFT MANAGEMENT
// ===========================================================================

// GET /api/admin/gifts
router.get('/gifts', adminUserController.getGifts);

// POST /api/admin/gifts
router.post('/gifts', verifyAdmin, adminUserController.addGift);

// PUT /api/admin/gifts/:id
router.put('/gifts/:id', verifyAdmin, adminUserController.updateGift);

// DELETE /api/admin/gifts/:id
router.delete('/gifts/:id', verifyAdmin, adminUserController.deleteGift);

// ===========================================================================
// RECHARGE HISTORY
// ===========================================================================

// GET /api/admin/recharges
router.get('/recharges', adminUserController.getRecharges);

// ===========================================================================
// SECURITY
// ===========================================================================

// GET /api/admin/security/logins
router.get('/security/logins', adminUserController.getSecurityLogins);

// POST /api/admin/security/block-ip
router.post('/security/block-ip', verifyAdmin, adminUserController.blockIp);

// ===========================================================================
// GLOBAL SETTINGS
// ===========================================================================

// GET /api/admin/global-settings
router.get('/global-settings', adminController.getGlobalSettings);

// PUT /api/admin/global-settings
router.put('/global-settings', verifyAdmin, adminController.updateGlobalSettings);

// ===========================================================================
// MOMENTS
// ===========================================================================

// GET /api/admin/moments 
router.get('/moments', momentController.getAllMoments);

// DELETE /api/admin/moments/:id
router.delete('/moments/:id', verifyAdmin, momentController.adminDeleteMoment);

// ===========================================================================
// SEARCH
// ===========================================================================

// GET /api/admin/search
router.get('/search', adminController.adminSearch);

module.exports = router;