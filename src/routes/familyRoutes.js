const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware } = require('../middlewares/auth.middleware');
const familyController = require('../controllers/familyController');
const familyWarController = require('../controllers/familyWarController');
const Family = require('../models/Family');
const FamilyTask = require('../models/FamilyTask');
const User = require('../models/User');

// ─── Flutter-compatible family routes ──────────────────────────
router.get('/members', authMiddleware, asyncHandler(async (req, res) => {
  const { familyId } = req.query;
  if (!familyId) return res.status(400).json({ success: false, message: 'familyId required' });

  const family = await Family.findOne({ family_id: familyId });
  if (!family) return res.json({ success: true, members: [] });

  const memberUsers = await User.find({ uid: { $in: family.members_list } })
    .select('uid username avatar level displayName name');
  res.json({ success: true, members: memberUsers });
}));

router.get('/ranking', authMiddleware, asyncHandler(async (req, res) => {
  const { period = 'all' } = req.query;
  const families = await Family.find({ is_active: true, is_banned: false })
    .sort({ total_xp: -1 }).limit(50);
  res.json({ success: true, rankings: families.map((f, i) => ({ ...f.toObject(), rank: i + 1 })) });
}));

router.get('/points', authMiddleware, asyncHandler(async (req, res) => {
  const { familyId } = req.query;
  if (!familyId) return res.status(400).json({ success: false, message: 'familyId required' });

  const family = await Family.findOne({ family_id: familyId }).select('family_points');
  res.json({ success: true, points: family?.family_points || 0 });
}));

router.post('/upgrade', authMiddleware, asyncHandler(async (req, res) => {
  const { familyId, upgradeType } = req.body;
  if (!familyId) return res.status(400).json({ success: false, message: 'familyId required' });

  const family = await Family.findOne({ family_id: familyId });
  if (!family) return res.status(404).json({ success: false, message: 'Family not found' });

  family.current_level = (family.current_level || 1) + 1;
  await family.save();

  res.json({ success: true, family });
}));

router.get('/tasks/daily', authMiddleware, asyncHandler(async (req, res) => {
  const { familyId } = req.query;
  if (!familyId) return res.status(400).json({ success: false, message: 'familyId required' });

  const dailyTasks = await FamilyTask.find({ familyId, taskType: 'daily_active_members', status: { $ne: 'expired' } });
  res.json({ success: true, tasks: dailyTasks });
}));

// ─── FAMILY CORE ───────────────────────────────────────────────────────
router.get('/mine', authMiddleware, asyncHandler(familyController.getMyFamily));
router.post('/create', authMiddleware, asyncHandler(familyController.createFamily));
router.post('/join', authMiddleware, asyncHandler(familyController.joinFamily));
router.post('/leave', authMiddleware, asyncHandler(familyController.leaveFamily));
router.get('/search', authMiddleware, asyncHandler(familyController.searchFamilies));
router.get('/search/users', authMiddleware, asyncHandler(familyController.searchUsersByUid));
router.get('/search/users-to-invite', authMiddleware, asyncHandler(familyController.searchUsersToInvite));
router.get('/:familyId', authMiddleware, asyncHandler(familyController.getFamilyInfo));
router.put('/update', authMiddleware, asyncHandler(familyController.updateFamilyDetails));

// ─── INVITATION SYSTEM ─────────────────────────────────────────────────
router.post('/invite/send', authMiddleware, asyncHandler(familyController.sendInvitation));
router.get('/invite/my', authMiddleware, asyncHandler(familyController.getMyInvitations));
router.get('/invite/sent', authMiddleware, asyncHandler(familyController.getSentInvitations));
router.post('/invite/respond', authMiddleware, asyncHandler(familyController.respondToInvitation));
router.post('/invite/cancel', authMiddleware, asyncHandler(familyController.cancelInvitation));

// ─── ADMIN MANAGEMENT ──────────────────────────────────────────────────
router.post('/admin/assign', authMiddleware, asyncHandler(familyController.assignAdmin));
router.post('/admin/remove', authMiddleware, asyncHandler(familyController.removeAdmin));
router.get('/admin/list', authMiddleware, asyncHandler(familyController.getAdminList));
router.post('/admin/transfer-ownership', authMiddleware, asyncHandler(familyController.transferOwnership));

// ─── FAMILY TASKS ──────────────────────────────────────────────────────
router.get('/tasks', authMiddleware, asyncHandler(familyController.getFamilyTasks));
router.get('/tasks/progress', authMiddleware, asyncHandler(familyController.getTaskProgress));
router.post('/tasks/submit', authMiddleware, asyncHandler(familyController.submitTaskProgress));
router.post('/tasks/claim', authMiddleware, asyncHandler(familyController.claimTaskRewards));

// ─── FAMILY SHOP ───────────────────────────────────────────────────────
router.get('/shop/items', authMiddleware, asyncHandler(familyController.getFamilyShopItems));
router.post('/shop/purchase', authMiddleware, asyncHandler(familyController.purchaseFamilyShopItem));
router.get('/shop/inventory', authMiddleware, asyncHandler(familyController.getFamilyInventory));

// ─── FAMILY CHAT ───────────────────────────────────────────────────────
router.get('/chat/messages', authMiddleware, asyncHandler(familyController.getFamilyChatMessages));
router.post('/chat/send', authMiddleware, asyncHandler(familyController.sendFamilyChatMessage));
router.post('/chat/delete', authMiddleware, asyncHandler(familyController.deleteFamilyChatMessage));
router.post('/chat/pin', authMiddleware, asyncHandler(familyController.pinFamilyChatMessage));
router.post('/chat/reaction', authMiddleware, asyncHandler(familyController.addChatReaction));

// ─── FAMILY PK BATTLES ─────────────────────────────────────────────────
router.post('/pk/create', authMiddleware, asyncHandler(familyController.createFamilyPK));
router.post('/pk/join', authMiddleware, asyncHandler(familyController.joinFamilyPK));
router.get('/pk/active', authMiddleware, asyncHandler(familyController.getActiveFamilyPK));
router.get('/pk/history', authMiddleware, asyncHandler(familyController.getFamilyPKHistory));
router.get('/pk/battle/:battleId', authMiddleware, asyncHandler(familyController.getFamilyPKDetail));

// ─── FAMILY WARS ───────────────────────────────────────────────────────
router.post('/wars/create', authMiddleware, asyncHandler(familyWarController.createWar));
router.get('/wars', authMiddleware, asyncHandler(familyWarController.getAllWars));
router.get('/wars/active', authMiddleware, asyncHandler(familyWarController.getActiveWars));
router.get('/wars/:warId', authMiddleware, asyncHandler(familyWarController.getWarById));
router.put('/wars/:warId/status', authMiddleware, asyncHandler(familyWarController.updateWarStatus));
router.post('/wars/:warId/gift', authMiddleware, asyncHandler(familyWarController.submitFamilyWarGift));
router.post('/wars/:warId/cancel', authMiddleware, asyncHandler(familyWarController.cancelWar));
router.get('/wars/:warId/leaderboard', authMiddleware, asyncHandler(familyWarController.getWarLeaderboard));

// ─── FAMILY RANKINGS ───────────────────────────────────────────────────
router.get('/rankings/daily', asyncHandler(familyController.getDailyFamilyRankings));
router.get('/rankings/weekly', asyncHandler(familyController.getWeeklyFamilyRankings));
router.get('/rankings/monthly', asyncHandler(familyController.getMonthlyFamilyRankings));

// ─── FAMILY LEADERBOARD ────────────────────────────────────────────────
router.get('/leaderboard', authMiddleware, asyncHandler(familyController.getFamilyLeaderboard));
router.post('/leaderboard/update', authMiddleware, asyncHandler(familyController.updateLeaderboard));

// ─── FAMILY STAY REWARD ────────────────────────────────────────────────
router.post('/stay/start', authMiddleware, asyncHandler(familyController.startStaySession));
router.post('/stay/redeem', authMiddleware, asyncHandler(familyController.redeemStayReward));
router.post('/stay/end', authMiddleware, asyncHandler(familyController.endStaySession));
router.get('/stay/my', authMiddleware, asyncHandler(familyController.getMyStaySession));

// ─── REWARD CONFIG (OWNER PANEL) ───────────────────────────────────────
router.get('/rewards/config', authMiddleware, asyncHandler(familyController.getRewardConfig));
router.put('/rewards/config', authMiddleware, asyncHandler(familyController.updateRewardConfig));

// ─── OFFICIAL ROOM ─────────────────────────────────────────────────────
router.post('/room/set-official', authMiddleware, asyncHandler(familyController.setOfficialRoom));

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────
router.get('/admin/all', authMiddleware, asyncHandler(familyController.adminGetAllFamilies));
router.put('/admin/:familyId/toggle', authMiddleware, asyncHandler(familyController.adminToggleFamilyStatus));
router.put('/admin/:familyId/ban', authMiddleware, asyncHandler(familyController.adminBanFamily));
router.put('/admin/:familyId/unban', authMiddleware, asyncHandler(familyController.adminUnbanFamily));
router.delete('/admin/:familyId', authMiddleware, asyncHandler(familyController.adminDeleteFamily));

module.exports = router;