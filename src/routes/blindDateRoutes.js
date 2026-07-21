const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/blindDateController');
const { authMiddleware, verifyStaff } = require('../middlewares/adminMiddleware');

// Profile
router.get('/profile', authMiddleware, ctrl.getProfile);
router.put('/profile', authMiddleware, ctrl.updateProfile);

// Queue
router.post('/join-queue', authMiddleware, ctrl.joinQueue);
router.post('/leave-queue', authMiddleware, ctrl.leaveQueue);

// Session
router.get('/session/:sessionId', authMiddleware, ctrl.getSession);
router.post('/:sessionId/decide', authMiddleware, ctrl.decide);
router.post('/:sessionId/report', authMiddleware, ctrl.reportSession);

// Owner: Icebreaker prompts
router.get('/prompts', ctrl.listPrompts);
router.post('/prompts', authMiddleware, verifyStaff, ctrl.createPrompt);
router.delete('/prompts/:promptId', authMiddleware, verifyStaff, ctrl.deletePrompt);

// Admin: sessions
router.get('/admin/sessions', authMiddleware, verifyStaff, ctrl.getAllSessions);

module.exports = router;
