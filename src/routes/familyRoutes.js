const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const familyController = require('../controllers/familyController');

// ─── FAMILY CORE ───────────────────────────────────────────────────────
router.get('/mine', authMiddleware, familyController.getMyFamily);
router.post('/create', authMiddleware, familyController.createFamily);
router.post('/join', authMiddleware, familyController.joinFamily);
router.post('/leave', authMiddleware, familyController.leaveFamily);
router.get('/search', authMiddleware, familyController.searchFamilies);
router.get('/search/users', authMiddleware, familyController.searchUsersByUid);
router.get('/search/users-to-invite', authMiddleware, familyController.searchUsersToInvite);
router.get('/:familyId', authMiddleware, familyController.getFamilyInfo);
router.put('/update', authMiddleware, familyController.updateFamilyDetails);

// ─── INVITATION SYSTEM ─────────────────────────────────────────────────
router.post('/invite/send', authMiddleware, familyController.sendInvitation);
router.get('/invite/my', authMiddleware, familyController.getMyInvitations);
router.get('/invite/sent', authMiddleware, familyController.getSentInvitations);
router.post('/invite/respond', authMiddleware, familyController.respondToInvitation);
router.post('/invite/cancel', authMiddleware, familyController.cancelInvitation);

// ─── ADMIN MANAGEMENT ──────────────────────────────────────────────────
router.post('/admin/assign', authMiddleware, familyController.assignAdmin);
router.post('/admin/remove', authMiddleware, familyController.removeAdmin);
router.get('/admin/list', authMiddleware, familyController.getAdminList);
router.post('/admin/transfer-ownership', authMiddleware, familyController.transferOwnership);

// ─── FAMILY TASKS ──────────────────────────────────────────────────────
router.get('/tasks', authMiddleware, familyController.getFamilyTasks);
router.get('/tasks/progress', authMiddleware, familyController.getTaskProgress);
router.post('/tasks/submit', authMiddleware, familyController.submitTaskProgress);
router.post('/tasks/claim', authMiddleware, familyController.claimTaskRewards);

// ─── FAMILY SHOP ───────────────────────────────────────────────────────
router.get('/shop/items', authMiddleware, familyController.getFamilyShopItems);
router.post('/shop/purchase', authMiddleware, familyController.purchaseFamilyShopItem);
router.get('/shop/inventory', authMiddleware, familyController.getFamilyInventory);

// ─── FAMILY CHAT ───────────────────────────────────────────────────────
router.get('/chat/messages', authMiddleware, familyController.getFamilyChatMessages);
router.post('/chat/send', authMiddleware, familyController.sendFamilyChatMessage);
router.post('/chat/delete', authMiddleware, familyController.deleteFamilyChatMessage);
router.post('/chat/pin', authMiddleware, familyController.pinFamilyChatMessage);
router.post('/chat/reaction', authMiddleware, familyController.addChatReaction);

// ─── FAMILY PK BATTLES ─────────────────────────────────────────────────
router.post('/pk/create', authMiddleware, familyController.createFamilyPK);
router.post('/pk/join', authMiddleware, familyController.joinFamilyPK);
router.get('/pk/active', authMiddleware, familyController.getActiveFamilyPK);
router.get('/pk/history', authMiddleware, familyController.getFamilyPKHistory);
router.get('/pk/battle/:battleId', authMiddleware, familyController.getFamilyPKDetail);

// ─── FAMILY WARS ───────────────────────────────────────────────────────
router.get('/wars/active', authMiddleware, familyController.getActiveFamilyWars);
router.get('/wars/history', authMiddleware, familyController.getFamilyWarHistory);
router.post('/wars/register', authMiddleware, familyController.registerForFamilyWar);
router.get('/wars/:warId/leaderboard', authMiddleware, familyController.getWarLeaderboard);
router.get('/wars/:warId/my-contribution', authMiddleware, familyController.getMyWarContribution);

// ─── FAMILY RANKINGS ───────────────────────────────────────────────────
router.get('/rankings/daily', familyController.getDailyFamilyRankings);
router.get('/rankings/weekly', familyController.getWeeklyFamilyRankings);
router.get('/rankings/monthly', familyController.getMonthlyFamilyRankings);

// ─── FAMILY LEADERBOARD ────────────────────────────────────────────────
router.get('/leaderboard', authMiddleware, familyController.getFamilyLeaderboard);
router.post('/leaderboard/update', authMiddleware, familyController.updateLeaderboard);

// ─── FAMILY STAY REWARD ────────────────────────────────────────────────
router.post('/stay/start', authMiddleware, familyController.startStaySession);
router.post('/stay/redeem', authMiddleware, familyController.redeemStayReward);
router.post('/stay/end', authMiddleware, familyController.endStaySession);
router.get('/stay/my', authMiddleware, familyController.getMyStaySession);

// ─── REWARD CONFIG (OWNER PANEL) ───────────────────────────────────────
router.get('/rewards/config', authMiddleware, familyController.getRewardConfig);
router.put('/rewards/config', authMiddleware, familyController.updateRewardConfig);

// ─── OFFICIAL ROOM ─────────────────────────────────────────────────────
router.post('/room/set-official', authMiddleware, familyController.setOfficialRoom);

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────
router.get('/admin/all', authMiddleware, familyController.adminGetAllFamilies);
router.put('/admin/:familyId/toggle', authMiddleware, familyController.adminToggleFamilyStatus);
router.put('/admin/:familyId/ban', authMiddleware, familyController.adminBanFamily);
router.put('/admin/:familyId/unban', authMiddleware, familyController.adminUnbanFamily);
router.delete('/admin/:familyId', authMiddleware, familyController.adminDeleteFamily);

module.exports = router;