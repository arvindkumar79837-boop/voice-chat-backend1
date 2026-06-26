const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const roomFeaturesController = require('../controllers/roomFeaturesController');

router.post('/create', authMiddleware, roomFeaturesController.createRoomWithDefaults);

router.post('/:roomId/follow', authMiddleware, roomFeaturesController.followRoom);
router.delete('/:roomId/unfollow', authMiddleware, roomFeaturesController.unfollowRoom);
router.get('/:roomId/followers', authMiddleware, roomFeaturesController.getRoomFollowers);
router.get('/my/followed', authMiddleware, roomFeaturesController.getMyFollowedRooms);

router.post('/promote-admin', authMiddleware, roomFeaturesController.promoteToAdmin);
router.post('/demote-admin', authMiddleware, roomFeaturesController.demoteAdmin);
router.get('/:roomId/admins', authMiddleware, roomFeaturesController.getRoomAdminList);

router.get('/:roomId/level', authMiddleware, roomFeaturesController.getRoomLevel);
router.post('/award-xp', authMiddleware, roomFeaturesController.awardXp);

router.put('/:roomId/privacy', authMiddleware, roomFeaturesController.updatePrivacy);
router.post('/verify-password', authMiddleware, roomFeaturesController.verifyRoomPassword);

router.put('/:roomId/notices', authMiddleware, roomFeaturesController.setNotice);
router.get('/:roomId/notices', roomFeaturesController.getNotices);

router.get('/:roomId/online-count', roomFeaturesController.getOnlineCount);

router.get('/leaderboard/:period', roomFeaturesController.getRoomLeaderboard);
router.get('/leaderboard/levels/all', roomFeaturesController.getRoomLeaderboardByLevel);

router.post('/track-time', authMiddleware, roomFeaturesController.trackTimeSpent);

router.get('/:roomId/dashboard', authMiddleware, roomFeaturesController.getRoomDashboardInfo);

module.exports = router;