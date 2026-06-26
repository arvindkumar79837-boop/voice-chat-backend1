const express = require('express');
const router = express.Router();
const roomController = require('../controllers/room.controller');
const roomProductionController = require('../controllers/room.production.controller');
const powerMatrixController = require('../controllers/powerMatrixController');
const authMiddleware = require('../middlewares/auth.middleware');
const { checkPowerMiddleware, checkRoomOwner } = require('../middlewares/powerValidation.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');

// ─── Room Varieties & Discovery ─────────────────────────────────
router.get('/live', roomProductionController.getLiveRooms);
router.get('/type/:roomType', roomProductionController.getRoomsByType);
router.get('/ranking', roomProductionController.getRoomRanking);
router.post('/create', authMiddleware, roomProductionController.createRoom);

// ─── Room Detail & Access ───────────────────────────────────────
router.get('/:roomId', roomProductionController.getRoomDetail);
router.post('/:roomId/join', authMiddleware, roomProductionController.joinRoom);
router.post('/:roomId/verify-password', authMiddleware, roomProductionController.verifyPassword);

// ─── Advanced Seat Controls ─────────────────────────────────────
router.post('/:roomId/seats/:seatIndex/lock', [authMiddleware, checkRoomOwner], roomProductionController.toggleSeatLock);
router.post('/:roomId/seats/:seatIndex/mute', [authMiddleware, checkRoomOwner, checkPowerMiddleware], roomProductionController.toggleSeatMute);
router.post('/:roomId/seats/:seatIndex/claim', authMiddleware, roomProductionController.claimSeat);
router.post('/:roomId/seats/:seatIndex/release', authMiddleware, roomProductionController.releaseSeat);
router.post('/:roomId/seats/:seatIndex/kick', [authMiddleware, checkRoomOwner, checkPowerMiddleware], roomProductionController.kickFromSeat);

// ─── Room Cosmetics ─────────────────────────────────────────────
router.put('/:roomId/cosmetics', [authMiddleware, checkRoomOwner], roomProductionController.updateCosmetics);
router.post('/:roomId/cosmetics/purchase-background', [authMiddleware, checkRoomOwner], roomProductionController.purchaseBackground);

// ─── Room Gifts ─────────────────────────────────────────────────
router.post('/:roomId/gift', authMiddleware, roomProductionController.sendGiftToRoom);

// ─── Room PK Battles ────────────────────────────────────────────
router.post('/:roomId/pk/challenge', authMiddleware, roomProductionController.challengeRoomPK);
router.get('/:roomId/pk/status', roomProductionController.getPKStatus);

// ─── Room Tasks ─────────────────────────────────────────────────
router.get('/:roomId/tasks', roomProductionController.getRoomTasks);
router.put('/:roomId/tasks/:taskId/progress', authMiddleware, roomProductionController.updateTaskProgress);
router.post('/:roomId/tasks/:taskId/claim', authMiddleware, roomProductionController.claimTaskReward);

// ─── Room Management (Owner) ────────────────────────────────────
router.put('/:roomId/settings', [authMiddleware, checkRoomOwner], roomProductionController.updateRoomSettings);
router.delete('/:roomId', [authMiddleware, checkRoomOwner], roomProductionController.closeRoom);
router.post('/:roomId/toggle-live', [authMiddleware, checkRoomOwner], roomProductionController.toggleLive);

// ===========================================================================
// POWER MATRIX
// ===========================================================================

// GET /api/rooms/power-matrix
router.get('/power-matrix', authMiddleware, verifyStaff, powerMatrixController.getPowerMatrix);

// PUT /api/rooms/power-matrix
router.put('/power-matrix', authMiddleware, verifyStaff, powerMatrixController.updatePowerMatrix);

// POST /api/rooms/power-matrix/reset
router.post('/power-matrix/reset', authMiddleware, verifyStaff, powerMatrixController.resetPowerMatrix);

// POST /api/rooms/check-power
router.post('/check-power', authMiddleware, checkPowerMiddleware, powerMatrixController.checkUserPower);

// GET /api/rooms/power-matrix/history
router.get('/power-matrix/history', authMiddleware, verifyStaff, powerMatrixController.getPowerMatrixHistory);

module.exports = router;
