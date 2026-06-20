const express = require('express');
const router = express.Router();
const moderationController = require('../controllers/moderationController');
const auth = require('../middlewares/auth.middleware');

router.get('/reports', auth, moderationController.getReports);
router.post('/report', auth, moderationController.reportContent);
router.post('/block', auth, moderationController.blockUser);

module.exports = router;