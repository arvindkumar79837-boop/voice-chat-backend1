const express = require('express');
const router = express.Router();
const lockCtrl = require('../controllers/roomLockController');
const musicCtrl = require('../controllers/musicBroadcastController');
const { authMiddleware, verifyStaff } = require('../middlewares/adminMiddleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── ROOM LOCK ────────────────────────────────────────────────────
router.post('/rooms/:roomId/lock',         validateObjectId('roomId'), authMiddleware, lockCtrl.lockRoom);
router.post('/rooms/:roomId/unlock-attempt', validateObjectId('roomId'), authMiddleware, lockCtrl.unlockAttempt);
router.post('/rooms/:roomId/unlock',       validateObjectId('roomId'), authMiddleware, lockCtrl.unlockRoom);

// ─── ROOM DISCOVERY ───────────────────────────────────────────────
router.get('/discover',                    lockCtrl.discoverRooms);

// ─── MUSIC / KARAOKE BROADCAST ────────────────────────────────────
router.post('/rooms/:roomId/music/play',   validateObjectId('roomId'), authMiddleware, musicCtrl.playTrack);
router.post('/rooms/:roomId/music/pause',  validateObjectId('roomId'), authMiddleware, musicCtrl.pauseTrack);
router.post('/rooms/:roomId/music/stop',   validateObjectId('roomId'), authMiddleware, musicCtrl.stopTrack);
router.get('/rooms/:roomId/music/current', musicCtrl.getCurrentTrack);

module.exports = router;
