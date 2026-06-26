const express = require('express');
const router = express.Router();
const dailyTaskController = require('../controllers/dailyTaskController');
const auth = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.get('/active', auth, dailyTaskController.getActiveTasks);
router.put('/:taskId/progress', auth, dailyTaskController.updateTaskProgress);
router.post('/:taskId/claim', auth, dailyTaskController.claimTaskReward);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', auth, adminAuth, dailyTaskController.adminGetAllTasks);
router.post('/admin/create', auth, adminAuth, dailyTaskController.createDailyTask);
router.put('/admin/:id', auth, adminAuth, dailyTaskController.adminUpdateTask);
router.delete('/admin/:id', auth, adminAuth, dailyTaskController.adminDeleteTask);
router.post('/admin/seed', auth, adminAuth, dailyTaskController.seedDefaultTasks);

module.exports = router;