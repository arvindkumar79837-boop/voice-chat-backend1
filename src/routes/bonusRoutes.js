const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const bonusController = require('../controllers/bonusController');

router.use(auth);

router.post('/bonus/award', bonusController.awardBonus);
router.get('/bonus/history/:hostId', bonusController.getHostBonuses);
router.get('/bonus/summary', bonusController.getMonthlyBonusSummary);
router.delete('/bonus/:bonusId', bonusController.removeBonus);

module.exports = router;