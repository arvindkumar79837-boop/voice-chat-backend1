const express = require('express');
const router = express.Router();
const dailyTaskController = require('../controllers/dailyTaskController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────
router.get('/active', validatePagination(), authMiddleware, dailyTaskController.getActiveTasks);
router.put('/:taskId/progress', validateObjectId('taskId'), authMiddleware, dailyTaskController.updateTaskProgress);
router.post('/:taskId/claim', validateObjectId('taskId'), authMiddleware, dailyTaskController.claimTaskReward);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────
router.get('/admin/all', validatePagination(), authMiddleware, adminAuth, dailyTaskController.adminGetAllTasks);
router.post('/admin/create', validateString('title', { required: true, maxLength: 200 }), validateNumber('reward', { required: false, min: 0 }), authMiddleware, adminAuth, dailyTaskController.createDailyTask);
router.put('/admin/:id', validateObjectId('id'), authMiddleware, adminAuth, dailyTaskController.adminUpdateTask);
router.delete('/admin/:id', authMiddleware, adminAuth, dailyTaskController.adminDeleteTask);
router.post('/admin/seed', authMiddleware, adminAuth, dailyTaskController.seedDefaultTasks);

module.exports = router;