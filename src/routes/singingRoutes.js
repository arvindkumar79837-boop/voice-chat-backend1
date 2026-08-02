const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/singingController');
const { authMiddleware, verifyStaff } = require('../middlewares/adminMiddleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Songs
router.get('/songs', validatePagination(), ctrl.searchSongs);
router.post('/songs', authMiddleware, verifyStaff, ctrl.addSong);
router.put('/songs/:songId', authMiddleware, verifyStaff, ctrl.updateSong);
router.delete('/songs/:songId', authMiddleware, verifyStaff, ctrl.deleteSong);

// Queue
router.post('/queue/join', authMiddleware, ctrl.joinQueue);
router.post('/queue/leave', authMiddleware, ctrl.leaveQueue);
router.get('/queue/:roomId', validatePagination(), authMiddleware, ctrl.getQueue);
router.post('/queue/remove', authMiddleware, ctrl.removeUserFromQueue);

// Performance control
router.post('/performance/start', authMiddleware, ctrl.startPerformance);
router.post('/performance/end', authMiddleware, ctrl.endPerformance);
router.post('/performance/mute', authMiddleware, ctrl.forceMutePerformer);

module.exports = router;
