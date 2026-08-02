const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/blindDateController');
const { authMiddleware, verifyStaff } = require('../middlewares/adminMiddleware');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// Profile
router.get('/profile', validatePagination(), authMiddleware, ctrl.getProfile);
router.put('/profile', validateString('bio', { required: false, maxLength: 500 }), authMiddleware, ctrl.updateProfile);

// Queue
router.post('/join-queue', authMiddleware, ctrl.joinQueue);
router.post('/leave-queue', authMiddleware, ctrl.leaveQueue);

// Session
router.get('/session/:sessionId', validatePagination(), authMiddleware, ctrl.getSession);
router.post('/:sessionId/decide', validateObjectId('sessionId'), validateEnum('decision', ['yes', 'no'], { required: true }), authMiddleware, ctrl.decide);
router.post('/:sessionId/report', validateObjectId('sessionId'), validateString('reason', { required: true, maxLength: 500 }), authMiddleware, ctrl.reportSession);

// Owner: Icebreaker prompts
router.get('/prompts', validatePagination(), ctrl.listPrompts);
router.post('/prompts', authMiddleware, verifyStaff, ctrl.createPrompt);
router.delete('/prompts/:promptId', authMiddleware, verifyStaff, ctrl.deletePrompt);

// Admin: sessions
router.get('/admin/sessions', validatePagination(), authMiddleware, verifyStaff, ctrl.getAllSessions);

module.exports = router;
