const express = require('express');
const router = express.Router();
const dailyTaskController = require('../controllers/dailyTaskController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.get('/active', authMiddleware, dailyTaskController.getActiveTasks);
router.put('/:taskId/progress', authMiddleware, dailyTaskController.updateTaskProgress);
router.post('/:taskId/claim', authMiddleware, dailyTaskController.claimTaskReward);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', authMiddleware, adminAuth, dailyTaskController.adminGetAllTasks);
router.post('/admin/create', authMiddleware, adminAuth, dailyTaskController.createDailyTask);
router.put('/admin/:id', authMiddleware, adminAuth, dailyTaskController.adminUpdateTask);
router.delete('/admin/:id', authMiddleware, adminAuth, dailyTaskController.adminDeleteTask);
router.post('/admin/seed', authMiddleware, adminAuth, dailyTaskController.seedDefaultTasks);

module.exports = router;