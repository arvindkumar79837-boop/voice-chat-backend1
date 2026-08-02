const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const roomProductionController = require('../controllers/room.production.controller');
const powerMatrixController = require('../controllers/powerMatrixController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { checkPowerMiddleware, checkRoomOwner } = require('../middlewares/powerValidation.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── Room Varieties & Discovery ─────────────────────────────────
router.get('/live', validatePagination(), asyncHandler(roomProductionController.getLiveRooms));
router.get('/type/:roomType', validatePagination(), asyncHandler(roomProductionController.getRoomsByType));
router.get('/ranking', validatePagination(), asyncHandler(roomProductionController.getRoomRanking));
router.post('/create', authMiddleware, validateString('name', { required: true, maxLength: 100 }), validateString('description', { required: false, maxLength: 500 }), validateEnum('roomType', ['voice', 'video', 'chat', 'gaming'], { required: true }), validateNumber('maxParticipants', { required: false, min: 2, max: 100 }), validateBoolean('isPrivate'), validateAllowedFields(['name', 'description', 'roomType', 'maxParticipants', 'isPrivate', 'category', 'tags']), asyncHandler(roomProductionController.createRoom));

// ─── Room Detail & Access ───────────────────────────────────────
router.get('/:roomId', validateObjectId('roomId'), validatePagination(), asyncHandler(roomProductionController.getRoomDetail));
router.post('/:roomId/join', validateObjectId('roomId'), authMiddleware, asyncHandler(roomProductionController.joinRoom));
router.post('/:roomId/verify-password', validateObjectId('roomId'), authMiddleware, validateString('password', { required: true }), validateAllowedFields(['password']), asyncHandler(roomProductionController.verifyPassword));

// ─── Advanced Seat Controls ─────────────────────────────────────
router.post('/:roomId/seats/:seatIndex/lock', validateObjectId('roomId'), [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.toggleSeatLock));
router.post('/:roomId/seats/:seatIndex/mute', validateObjectId('roomId'), [authMiddleware, checkRoomOwner, checkPowerMiddleware], asyncHandler(roomProductionController.toggleSeatMute));
router.post('/:roomId/seats/:seatIndex/claim', validateObjectId('roomId'), authMiddleware, asyncHandler(roomProductionController.claimSeat));
router.post('/:roomId/seats/:seatIndex/release', validateObjectId('roomId'), authMiddleware, asyncHandler(roomProductionController.releaseSeat));
router.post('/:roomId/seats/:seatIndex/kick', validateObjectId('roomId'), [authMiddleware, checkRoomOwner, checkPowerMiddleware], asyncHandler(roomProductionController.kickFromSeat));

// ─── Room Cosmetics ─────────────────────────────────────────────
router.put('/:roomId/cosmetics', validateObjectId('roomId'), [authMiddleware, checkRoomOwner], validateAllowedFields(['background', 'frame', 'badge']), asyncHandler(roomProductionController.updateCosmetics));
router.post('/:roomId/cosmetics/purchase-background', validateObjectId('roomId'), [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.purchaseBackground));

// ─── Room Gifts ─────────────────────────────────────────────────
router.post('/:roomId/gift', validateObjectId('roomId'), authMiddleware, validateNumber('giftId', { required: true }), validateNumber('quantity', { required: true, min: 1 }), validateAllowedFields(['giftId', 'quantity']), asyncHandler(roomProductionController.sendGiftToRoom));

// ─── Room PK Battles ────────────────────────────────────────────
router.post('/:roomId/pk/challenge', validateObjectId('roomId'), authMiddleware, asyncHandler(roomProductionController.challengeRoomPK));
router.get('/:roomId/pk/status', validatePagination(), asyncHandler(roomProductionController.getPKStatus));

// ─── Room Tasks ─────────────────────────────────────────────────
router.get('/:roomId/tasks', validatePagination(), asyncHandler(roomProductionController.getRoomTasks));
router.put('/:roomId/tasks/:taskId/progress', validateObjectId('roomId'), validateObjectId('taskId'), authMiddleware, asyncHandler(roomProductionController.updateTaskProgress));
router.post('/:roomId/tasks/:taskId/claim', validateObjectId('roomId'), validateObjectId('taskId'), authMiddleware, asyncHandler(roomProductionController.claimTaskReward));

// ─── Room Management (Owner) ────────────────────────────────────
router.put('/:roomId/settings', validateObjectId('roomId'), [authMiddleware, checkRoomOwner], validateAllowedFields(['name', 'description', 'category', 'isPrivate', 'maxParticipants', 'settings', 'tags']), asyncHandler(roomProductionController.updateRoomSettings));
router.delete('/:roomId', validateObjectId('roomId'), [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.closeRoom));
router.post('/:roomId/toggle-live', validateObjectId('roomId'), [authMiddleware, checkRoomOwner], asyncHandler(roomProductionController.toggleLive));

// ===========================================================================
// POWER MATRIX
// ===========================================================================

// GET /api/rooms/power-matrix
router.get('/power-matrix', validatePagination(), authMiddleware, verifyStaff, asyncHandler(powerMatrixController.getPowerMatrix));

// PUT /api/rooms/power-matrix
router.put('/power-matrix', authMiddleware, verifyStaff, validateAllowedFields(['matrix']), asyncHandler(powerMatrixController.updatePowerMatrix));

// POST /api/rooms/power-matrix/reset
router.post('/power-matrix/reset', authMiddleware, verifyStaff, validateAllowedFields([]), asyncHandler(powerMatrixController.resetPowerMatrix));

// POST /api/rooms/check-power
router.post('/check-power', authMiddleware, checkPowerMiddleware, asyncHandler(powerMatrixController.checkUserPower));

// GET /api/rooms/power-matrix/history
router.get('/power-matrix/history', validatePagination(), authMiddleware, verifyStaff, asyncHandler(powerMatrixController.getPowerMatrixHistory));


// ─── Room Members (migrated from agoraController) (P0-1) ──────────────────
router.get('/:roomId/members', authMiddleware, asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const RoomSeat = require('../models/RoomSeat');
  const seats = await RoomSeat.find({ roomId, isActive: true })
    .populate('userId', 'name avatar uid');

  const members = seats.map((seat) => ({
    userId: seat.userId?._id || seat.userId,
    userName: seat.userId?.name || 'Unknown',
    userAvatar: seat.userId?.avatar || null,
    uid: seat.userId?.uid || null,
    seat: seat.seatNumber,
    isHost: seat.isHost,
    isActive: seat.isActive,
    joinedAt: seat.joinedAt,
  }));

  res.json({ success: true, data: { members, total: members.length } });
}));

module.exports = router;
