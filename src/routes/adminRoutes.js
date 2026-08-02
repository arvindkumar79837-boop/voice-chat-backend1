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
const rewardInjectorController = require('../controllers/rewardInjectorController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const verifyAdmin = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');
const isAdmin = verifyAdmin;

// Protect all admin routes
router.use(authMiddleware);
router.use(verifyStaff);

// ===========================================================================
// DASHBOARD
// ===========================================================================

// GET /api/admin/stats
router.get('/stats', validatePagination(), adminController.getStats);

// GET /api/admin/dashboard/activity
router.get('/dashboard/activity', validatePagination(), adminController.getLiveRooms);

// GET /api/admin/rooms/live
router.get('/rooms/live', validatePagination(), adminController.getLiveRooms);

// ===========================================================================
// USER MANAGEMENT
// ===========================================================================

// GET /api/admin/users
router.get('/users', validatePagination(), adminController.getUsers);

// POST /api/admin/users/search-user
router.post('/search-user', validateString('query', { required: true, maxLength: 100 }), validateAllowedFields(['query']), staffController.searchUser);

// GET /api/admin/users/:id
router.get('/users/:id', validatePagination(), adminController.getUserDetail);

// PUT /api/admin/users/:id
router.put('/users/:id', validateObjectId('id'), adminController.updateUser);

// POST /api/admin/users/block/:userId
router.post('/users/block/:userId', validateObjectId('userId'), validateEnum('isBanned', [true, false], { required: true }), adminController.toggleBan);

// POST /api/admin/users/unblock/:userId
router.post('/users/unblock/:userId', validateObjectId('userId'), validateEnum('isBanned', [true, false], { required: true }), adminController.toggleBan);

// PUT /api/admin/users/verify/:userId
router.put('/users/verify/:userId', validateObjectId('userId'), adminUserController.verifyUser);

// POST /api/admin/users/adjust-coins/:userId
router.post('/users/adjust-coins/:userId', validateObjectId('userId'), validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), adminUserController.adjustUserCoins);

// POST /api/admin/users/balance/:userId
router.post('/users/balance/:userId', validateObjectId('userId'), validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), adminUserController.adjustUserCoins);

// ===========================================================================
// WALLET MANAGEMENT
// ===========================================================================

// GET /api/admin/wallets
router.get('/wallets', validatePagination(), adminController.getWallets);

// POST /api/admin/wallets/adjust/:userId
router.post('/wallets/adjust/:userId', validateObjectId('userId'), validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), adminController.adjustWallet);

// ===========================================================================
// WITHDRAWALS
// ===========================================================================

// GET /api/admin/withdrawals/pending
router.get('/withdrawals/pending', validatePagination(), adminUserController.getWithdrawals);

// POST /api/admin/withdrawals/approve/:id
router.post('/withdrawals/approve/:id', validateObjectId('id'), adminUserController.approveWithdrawal);

// POST /api/admin/withdrawals/reject/:id
router.post('/withdrawals/reject/:id', validateObjectId('id'), adminUserController.rejectWithdrawal);

// ===========================================================================
// ANNOUNCEMENTS
// ===========================================================================

// GET /api/admin/announcements
router.get('/announcements', validatePagination(), adminUserController.getAnnouncements);

// POST /api/admin/announcement
router.post('/announcement', validateString('title', { required: true, maxLength: 200 }), validateString('message', { required: true, maxLength: 1000 }), adminUserController.sendAnnouncement);

// ===========================================================================
// STAFF / ADMIN MANAGEMENT
// ===========================================================================

// GET /api/admin/staff/list
router.get('/staff/list', validatePagination(), staffController.getStaffList);

// POST /api/admin/staff/create
router.post('/staff/create', verifyAdmin, staffController.createStaff);

// PUT /api/admin/staff/update/:id
router.put('/staff/update/:id', validateObjectId('id'), verifyAdmin, staffController.updateStaff);

// DELETE /api/admin/staff/delete/:id
router.delete('/staff/delete/:id', verifyAdmin, staffController.deleteStaff);

// GET /api/admin/roles
router.get('/roles', validatePagination(), staffController.getAdminRoles);

// POST /api/admin/roles/create
router.post('/roles/create', isAdmin, staffController.createAdminRole);

// PUT /api/admin/roles/update/:id
router.put('/roles/update/:id', validateObjectId('id'), isAdmin, staffController.updateAdminRole);

// ===========================================================================
// SETTINGS
// ===========================================================================

// GET /api/admin/settings
router.get('/settings', validatePagination(), adminController.getSettings);

// PUT /api/admin/settings
router.put('/settings', verifyAdmin, adminController.updateSettings);

// ===========================================================================
// COINS & TREASURY
// ===========================================================================

// POST /api/admin/coins/generate
router.post('/coins/generate', validateNumber('coins', { required: true, min: 0 }), verifyAdmin, treasuryController.generateCoins);

// POST /api/admin/coins/deduct
router.post('/coins/deduct', validateNumber('coins', { required: true, min: 0 }), verifyAdmin, treasuryController.deductCoins);

// GET /api/admin/coin-orders
router.get('/coin-orders', validatePagination(), treasuryController.getCoinOrders);

// ===========================================================================
// REWARDS
// ===========================================================================

// POST /api/admin/rewards/send
router.post('/rewards/send', validateBodyObjectId('userId'), validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), verifyAdmin, treasuryController.sendReward);

// ===========================================================================
// VIP MANAGEMENT 
// ===========================================================================

// GET /api/admin/vip/plans
router.get('/vip/plans', validatePagination(), vipController.getVipPlans);

// POST /api/admin/vip/plans/create
router.post('/vip/plans/create', verifyAdmin, vipController.createVipPlan);

// PUT /api/admin/vip/plans/update/:id
router.put('/vip/plans/update/:id', validateObjectId('id'), verifyAdmin, vipController.updateVipPlan);

// ===========================================================================
// AGENCY MANAGEMENT
// ===========================================================================

// GET /api/admin/agencies
router.get('/agencies', validatePagination(), agencyController.getAgencies);

// POST /api/admin/agencies/approve/:id
router.post('/agencies/approve/:id', validateObjectId('id'), verifyAdmin, agencyController.approveAgency);

// POST /api/admin/agencies/revoke/:id
router.post('/agencies/revoke/:id', validateObjectId('id'), verifyAdmin, agencyController.revokeAgency);

// ===========================================================================
// FAMILY MANAGEMENT
// ===========================================================================

// GET /api/admin/families
router.get('/families', validatePagination(), familyController.adminGetAllFamilies);

// DELETE /api/admin/families/:id
router.delete('/families/:id', validateObjectId('id'), verifyAdmin, familyController.adminDeleteFamily);

// ===========================================================================
// EVENTS
// ===========================================================================

// GET /api/admin/events
router.get('/events', validatePagination(), eventController.getActiveEvents);

// POST /api/admin/events
router.post('/events', verifyAdmin, eventController.createEvent);

// PUT /api/admin/events/:id
router.put('/events/:id', validateObjectId('id'), verifyAdmin, eventController.updateEvent);

// DELETE /api/admin/events/:id
router.delete('/events/:id', verifyAdmin, eventController.deleteEvent);

// ===========================================================================
// REPORTS
// ===========================================================================

// GET /api/admin/reports
router.get('/reports', validatePagination(), reportController.getReports);

// POST /api/admin/reports/resolve/:id
router.post('/reports/resolve/:id', validateObjectId('id'), verifyAdmin, reportController.resolveReport);

// DELETE /api/admin/reports/:id
router.delete('/reports/:id', validateObjectId('id'), verifyAdmin, reportController.resolveReport);

// ===========================================================================
// BANS
// ===========================================================================

// GET /api/admin/bans
router.get('/bans', validatePagination(), adminController.getBans);

// POST /api/admin/bans
router.post('/bans', validateBodyObjectId('userId'), verifyAdmin, adminController.createBan);

// DELETE /api/admin/bans/:id
router.delete('/bans/:id', verifyAdmin, adminController.liftBan);

// ===========================================================================
// NOTIFICATIONS
// ===========================================================================

// POST /api/admin/notifications/send
router.post('/notifications/send', validateString('title', { required: true, maxLength: 200 }), validateString('message', { required: true, maxLength: 1000 }), verifyAdmin, notificationController.sendNotification);

// GET /api/admin/notifications/history
router.get('/notifications/history', validatePagination(), notificationController.getNotificationHistory);

// ===========================================================================
// AUDIT LOGS
// ===========================================================================

// GET /api/admin/audit-logs
router.get('/audit-logs', validatePagination(), staffController.getAuditLogs);

// ===========================================================================
// LEADERBOARD
// ===========================================================================

// GET /api/admin/leaderboard
router.get('/leaderboard', validatePagination(), rankController.getAdminLeaderboard);

// POST /api/admin/leaderboard/reset
router.post('/leaderboard/reset', verifyAdmin, rankController.resetLeaderboard);

// ===========================================================================
// SUPPORT TICKETS
// ===========================================================================

// GET /api/admin/support/tickets
router.get('/support/tickets', validatePagination(), supportController.getTickets);

// POST /api/admin/support/tickets/reply/:id
router.post('/support/tickets/reply/:id', validateObjectId('id'), verifyAdmin, supportController.replyToTicket);

// ===========================================================================
// GIFT MANAGEMENT
// ===========================================================================

// GET /api/admin/gifts
router.get('/gifts', validatePagination(), adminUserController.getGifts);

// POST /api/admin/gifts
router.post('/gifts', validateString('name', { required: true, maxLength: 100 }), validateString('description', { required: false, maxLength: 500 }), validateNumber('price', { required: true, min: 0 }), validateNumber('diamondValue', { required: false, min: 0 }), validateEnum('category', ['standard', 'premium', 'limited', 'special'], { required: true }), verifyAdmin, adminUserController.addGift);

// PUT /api/admin/gifts/:id
router.put('/gifts/:id', validateObjectId('id'), verifyAdmin, adminUserController.updateGift);

// DELETE /api/admin/gifts/:id
router.delete('/gifts/:id', verifyAdmin, adminUserController.deleteGift);

// ===========================================================================
// RECHARGE HISTORY
// ===========================================================================

// GET /api/admin/recharges
router.get('/recharges', validatePagination(), adminUserController.getRecharges);

// ===========================================================================
// SECURITY
// ===========================================================================

// GET /api/admin/security/logins
router.get('/security/logins', validatePagination(), adminUserController.getSecurityLogins);

// POST /api/admin/security/block-ip
router.post('/security/block-ip', validateString('ipAddress', { required: true }), verifyAdmin, adminUserController.blockIp);

// ===========================================================================
// GLOBAL SETTINGS
// ===========================================================================

// GET /api/admin/global-settings
router.get('/global-settings', validatePagination(), adminController.getGlobalSettings);

// PUT /api/admin/global-settings
router.put('/global-settings', validateString('key', { required: true, maxLength: 100 }), validateAllowedFields(['key', 'value']), verifyAdmin, adminController.updateGlobalSettings);

// ===========================================================================
// MOMENTS
// ===========================================================================

// GET /api/admin/moments 
router.get('/moments', validatePagination(), momentController.getAllMoments);

// DELETE /api/admin/moments/:id
router.delete('/moments/:id', validateObjectId('id'), verifyAdmin, momentController.adminDeleteMoment);

// ===========================================================================
// REWARD INJECTOR (UID-targeted asset injection)
// ===========================================================================

// POST /api/admin/rewards/inject - Inject assets to a target UID
router.post('/rewards/inject', validateBodyObjectId('userId'), validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), verifyAdmin, rewardInjectorController.injectReward);

// GET /api/admin/rewards/history - Reward injection history
router.get('/rewards/history', validatePagination(), rewardInjectorController.getRewardHistory);

// POST /api/admin/rewards/revoke/:id - Revoke a reward injection
router.post('/rewards/revoke/:id', validateObjectId('id'), verifyAdmin, rewardInjectorController.revokeReward);

// GET /api/admin/rewards/user/:uid - Get rewards for a UID
router.get('/rewards/user/:uid', validatePagination(), rewardInjectorController.getUserRewards);

// ===========================================================================
// REWARD CONFIG (Dynamic probability & prize management)
// ===========================================================================

const rewardConfigController = require('../controllers/rewardConfigController');

// POST /api/admin/reward-configs - Create reward configuration
router.post('/reward-configs', validateString('configName', { required: true, maxLength: 100 }), validateString('gameType', { required: true, maxLength: 50 }), validateEnum('gameType', ['lucky_draw', 'treasure_hunt', 'wheel', 'scratch_card', 'jackpot'], { required: true }), validateNumber('probability', { required: true, min: 0, max: 100 }), validateNumber('rewardAmount', { required: true, min: 0 }), validateEnum('rewardType', ['coins', 'diamonds', 'xp', 'badge'], { required: true }), verifyAdmin, rewardConfigController.createRewardConfig);

// GET /api/admin/reward-configs - Get all reward configurations
router.get('/reward-configs', validatePagination(), rewardConfigController.getAllRewardConfigs);

// GET /api/admin/reward-configs/:id - Get single reward config
router.get('/reward-configs/:id', validatePagination(), rewardConfigController.getRewardConfigById);

// PUT /api/admin/reward-configs/:id - Update reward config (live)
router.put('/reward-configs/:id', validateObjectId('id'), verifyAdmin, rewardConfigController.updateRewardConfig);

// DELETE /api/admin/reward-configs/:id - Delete reward config
router.delete('/reward-configs/:id', validateObjectId('id'), verifyAdmin, rewardConfigController.deleteRewardConfig);

// POST /api/admin/reward-configs/:id/deploy - Deploy config as active
router.post('/reward-configs/:id/deploy', validateObjectId('id'), verifyAdmin, rewardConfigController.deployRewardConfig);

// GET /api/admin/reward-configs/analytics/:id - Get config analytics
router.get('/reward-configs/analytics/:id', validatePagination(), rewardConfigController.getRewardAnalytics);

// GET /api/admin/reward-configs/tiers - Get reward tier definitions
router.get('/reward-configs/tiers', validatePagination(), rewardConfigController.getRewardTiers);

// ===========================================================================
// SEARCH
// ===========================================================================

// GET /api/admin/search
router.get('/search', validatePagination(), adminController.adminSearch);

module.exports = router;
