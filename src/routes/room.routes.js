const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const roomController = require('../controllers/room.controller');
const roomProductionController = require('../controllers/room.production.controller');
const powerMatrixController = require('../controllers/powerMatrixController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { checkPowerMiddleware, checkRoomOwner } = require('../middlewares/powerValidation.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');

// ─── Room Varieties & Discovery ─────────────────────────────────
router.get('/live', asyncHandler(roomProductionController.getLiveRooms));
router.get('/type/:roomType', asyncHandler(roomProductionController.getRoomsByType));
router.get('/ranking', asyncHandler(roomProductionController.getRoomRanking));
router.post('/create', authMiddleware, asyncHandler(roomProductionController.createRoom));

// ─── Room Detail & Access ───────────────────────────────────────
router.get('/:roomId', asyncHandler(roomProductionController.getRoomDetail));
router.post('/:roomId/join', authMiddleware, asyncHandler(roomProductionController.joinRoom));
router.post('/:roomId/verify-password', authMiddleware, asyncHandler(roomProductionController.verifyPassword));

// ─── Advanced Seat Controls ─────────────────────────────────────
router.post('/:roomId/seats/:seatIndex/lock', [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.toggleSeatLock));
router.post('/:roomId/seats/:seatIndex/mute', [authMiddleware, checkRoomOwner, checkPowerMiddleware], asyncHandler(roomProductionController.toggleSeatMute));
router.post('/:roomId/seats/:seatIndex/claim', authMiddleware, asyncHandler(roomProductionController.claimSeat));
router.post('/:roomId/seats/:seatIndex/release', authMiddleware, asyncHandler(roomProductionController.releaseSeat));
router.post('/:roomId/seats/:seatIndex/kick', [authMiddleware, checkRoomOwner, checkPowerMiddleware], asyncHandler(roomProductionController.kickFromSeat));

// ─── Room Cosmetics ─────────────────────────────────────────────
router.put('/:roomId/cosmetics', [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.updateCosmetics));
router.post('/:roomId/cosmetics/purchase-background', [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.purchaseBackground));

// ─── Room Gifts ─────────────────────────────────────────────────
router.post('/:roomId/gift', authMiddleware, asyncHandler(roomProductionController.sendGiftToRoom));

// ─── Room PK Battles ────────────────────────────────────────────
router.post('/:roomId/pk/challenge', authMiddleware, asyncHandler(roomProductionController.challengeRoomPK));
router.get('/:roomId/pk/status', asyncHandler(roomProductionController.getPKStatus));

// ─── Room Tasks ─────────────────────────────────────────────────
router.get('/:roomId/tasks', asyncHandler(roomProductionController.getRoomTasks));
router.put('/:roomId/tasks/:taskId/progress', authMiddleware, asyncHandler(roomProductionController.updateTaskProgress));
router.post('/:roomId/tasks/:taskId/claim', authMiddleware, asyncHandler(roomProductionController.claimTaskReward));

// ─── Room Management (Owner) ────────────────────────────────────
router.put('/:roomId/settings', [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.updateRoomSettings));
router.delete('/:roomId', [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.closeRoom));
router.post('/:roomId/toggle-live', [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.toggleLive));

// ===========================================================================
// POWER MATRIX
// ===========================================================================

// GET /api/rooms/power-matrix
router.get('/power-matrix', authMiddleware, verifyStaff, asyncHandler(powerMatrixController.getPowerMatrix));

// PUT /api/rooms/power-matrix
router.put('/power-matrix', authMiddleware, verifyStaff, asyncHandler(powerMatrixController.updatePowerMatrix));

// POST /api/rooms/power-matrix/reset
router.post('/power-matrix/reset', authMiddleware, verifyStaff, asyncHandler(powerMatrixController.resetPowerMatrix));

// POST /api/rooms/check-power
router.post('/check-power', authMiddleware, checkPowerMiddleware, asyncHandler(powerMatrixController.checkUserPower));

// GET /api/rooms/power-matrix/history
router.get('/power-matrix/history', authMiddleware, verifyStaff, asyncHandler(powerMatrixController.getPowerMatrixHistory));

module.exports = router;
