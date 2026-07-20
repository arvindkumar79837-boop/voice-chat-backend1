const express = require('express');
const router = express.Router();
const lockCtrl = require('../controllers/roomLockController');
const musicCtrl = require('../controllers/musicBroadcastController');
const { authMiddleware, verifyStaff } = require('../middlewares/adminMiddleware');

// ─── ROOM LOCK ────────────────────────────────────────────────────
router.post('/rooms/:roomId/lock',         authMiddleware, lockCtrl.lockRoom);
router.post('/rooms/:roomId/unlock-attempt', lockCtrl.unlockAttempt);
router.post('/rooms/:roomId/unlock',       authMiddleware, lockCtrl.unlockRoom);

// ─── ROOM DISCOVERY ───────────────────────────────────────────────
router.get('/discover',                    lockCtrl.discoverRooms);

// ─── MUSIC / KARAOKE BROADCAST ────────────────────────────────────
router.post('/rooms/:roomId/music/play',   authMiddleware, musicCtrl.playTrack);
router.post('/rooms/:roomId/music/pause',  authMiddleware, musicCtrl.pauseTrack);
router.post('/rooms/:roomId/music/stop',   authMiddleware, musicCtrl.stopTrack);
router.get('/rooms/:roomId/music/current', musicCtrl.getCurrentTrack);

module.exports = router;
