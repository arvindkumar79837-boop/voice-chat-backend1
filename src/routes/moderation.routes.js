const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { verifyStaff } = require('../middlewares/adminMiddleware');
const moderationController = require('../controllers/moderationController');
const contentModerationController = require('../controllers/contentModerationController');

router.get('/reports', verifyStaff, contentModerationController.getReports);
router.post('/report', authMiddleware, contentModerationController.reportContent);
router.post('/block', authMiddleware, moderationController.blockUser);
router.put('/resolve/:reportId', verifyStaff, contentModerationController.resolveReport);
router.put('/dismiss/:reportId', verifyStaff, contentModerationController.dismissReport);

module.exports = router;
