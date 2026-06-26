const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const familyController = require('../controllers/familyController');

// ─── FAMILY CORE ───────────────────────────────────────────────────────
router.get('/mine', auth, familyController.getMyFamily);
router.post('/create', auth, familyController.createFamily);
router.post('/join', auth, familyController.joinFamily);
router.post('/leave', auth, familyController.leaveFamily);
router.get('/search', auth, familyController.searchFamilies);
router.get('/search/users', auth, familyController.searchUsersByUid);
router.get('/search/users-to-invite', auth, familyController.searchUsersToInvite);
router.get('/:familyId', auth, familyController.getFamilyInfo);
router.put('/update', auth, familyController.updateFamilyDetails);

// ─── INVITATION SYSTEM ─────────────────────────────────────────────────
router.post('/invite/send', auth, familyController.sendInvitation);
router.get('/invite/my', auth, familyController.getMyInvitations);
router.get('/invite/sent', auth, familyController.getSentInvitations);
router.post('/invite/respond', auth, familyController.respondToInvitation);
router.post('/invite/cancel', auth, familyController.cancelInvitation);

// ─── ADMIN MANAGEMENT ──────────────────────────────────────────────────
router.post('/admin/assign', auth, familyController.assignAdmin);
router.post('/admin/remove', auth, familyController.removeAdmin);
router.get('/admin/list', auth, familyController.getAdminList);
router.post('/admin/transfer-ownership', auth, familyController.transferOwnership);

// ─── FAMILY TASKS ──────────────────────────────────────────────────────
router.get('/tasks', auth, familyController.getFamilyTasks);
router.get('/tasks/progress', auth, familyController.getTaskProgress);
router.post('/tasks/submit', auth, familyController.submitTaskProgress);
router.post('/tasks/claim', auth, familyController.claimTaskRewards);

// ─── FAMILY SHOP ───────────────────────────────────────────────────────
router.get('/shop/items', auth, familyController.getFamilyShopItems);
router.post('/shop/purchase', auth, familyController.purchaseFamilyShopItem);
router.get('/shop/inventory', auth, familyController.getFamilyInventory);

// ─── FAMILY CHAT ───────────────────────────────────────────────────────
router.get('/chat/messages', auth, familyController.getFamilyChatMessages);
router.post('/chat/send', auth, familyController.sendFamilyChatMessage);
router.post('/chat/delete', auth, familyController.deleteFamilyChatMessage);
router.post('/chat/pin', auth, familyController.pinFamilyChatMessage);
router.post('/chat/reaction', auth, familyController.addChatReaction);

// ─── FAMILY PK BATTLES ─────────────────────────────────────────────────
router.post('/pk/create', auth, familyController.createFamilyPK);
router.post('/pk/join', auth, familyController.joinFamilyPK);
router.get('/pk/active', auth, familyController.getActiveFamilyPK);
router.get('/pk/history', auth, familyController.getFamilyPKHistory);
router.get('/pk/battle/:battleId', auth, familyController.getFamilyPKDetail);

// ─── FAMILY WARS ───────────────────────────────────────────────────────
router.get('/wars/active', auth, familyController.getActiveFamilyWars);
router.get('/wars/history', auth, familyController.getFamilyWarHistory);
router.post('/wars/register', auth, familyController.registerForFamilyWar);
router.get('/wars/:warId/leaderboard', auth, familyController.getWarLeaderboard);
router.get('/wars/:warId/my-contribution', auth, familyController.getMyWarContribution);

// ─── FAMILY RANKINGS ───────────────────────────────────────────────────
router.get('/rankings/daily', familyController.getDailyFamilyRankings);
router.get('/rankings/weekly', familyController.getWeeklyFamilyRankings);
router.get('/rankings/monthly', familyController.getMonthlyFamilyRankings);

// ─── FAMILY LEADERBOARD ────────────────────────────────────────────────
router.get('/leaderboard', auth, familyController.getFamilyLeaderboard);
router.post('/leaderboard/update', auth, familyController.updateLeaderboard);

// ─── FAMILY STAY REWARD ────────────────────────────────────────────────
router.post('/stay/start', auth, familyController.startStaySession);
router.post('/stay/redeem', auth, familyController.redeemStayReward);
router.post('/stay/end', auth, familyController.endStaySession);
router.get('/stay/my', auth, familyController.getMyStaySession);

// ─── REWARD CONFIG (OWNER PANEL) ───────────────────────────────────────
router.get('/rewards/config', auth, familyController.getRewardConfig);
router.put('/rewards/config', auth, familyController.updateRewardConfig);

// ─── OFFICIAL ROOM ─────────────────────────────────────────────────────
router.post('/room/set-official', auth, familyController.setOfficialRoom);

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────
router.get('/admin/all', auth, familyController.adminGetAllFamilies);
router.put('/admin/:familyId/toggle', auth, familyController.adminToggleFamilyStatus);
router.put('/admin/:familyId/ban', auth, familyController.adminBanFamily);
router.put('/admin/:familyId/unban', auth, familyController.adminUnbanFamily);
router.delete('/admin/:familyId', auth, familyController.adminDeleteFamily);

module.exports = router;