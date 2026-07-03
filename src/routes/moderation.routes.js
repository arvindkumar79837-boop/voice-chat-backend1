const express = require('express');
const router = express.Router();
const moderationController = require('../controllers/moderationController');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/reports', authMiddleware, moderationController.getReports);
router.post('/report', authMiddleware, moderationController.reportContent);
router.post('/block', authMiddleware, moderationController.blockUser);

module.exports = router;