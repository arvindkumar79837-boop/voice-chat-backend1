const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware } = require('../middlewares/auth.middleware');
const missionController = require('../controllers/missionController');

router.get('/', authMiddleware, asyncHandler(missionController.getMissions));
router.post('/claim', authMiddleware, asyncHandler(missionController.claimReward));

module.exports = router;
