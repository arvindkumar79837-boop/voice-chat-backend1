const express = require('express');
const router = express.Router();
const matchmakingController = require('../controllers/matchmaking.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/search', auth, matchmakingController.searchMatch);
router.post('/stop', auth, matchmakingController.stopSearch);

module.exports = router;