const express = require('express');
const router = express.Router();
const pkBattleController = require('../controllers/pkBattle.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// All PK Battle routes require user authentication
router.use(authMiddleware);

router.post('/request', pkBattleController.requestBattle);
router.post('/accept', pkBattleController.acceptBattle);
router.post('/end', pkBattleController.endBattle); // Typically for admin/host

module.exports = router;