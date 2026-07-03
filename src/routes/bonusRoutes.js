const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const bonusController = require('../controllers/bonusController');

router.use(authMiddleware);

router.post('/bonus/award', bonusController.awardBonus);
router.get('/bonus/history/:hostId', bonusController.getHostBonuses);
router.get('/bonus/summary', bonusController.getMonthlyBonusSummary);
router.delete('/bonus/:bonusId', bonusController.removeBonus);

module.exports = router;