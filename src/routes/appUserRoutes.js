const express = require('express');
const router = express.Router();
const appUserController = require('../controllers/appUserController');
const authMiddleware = require('../middlewares/auth.middleware');

// App Users Routes — all require authentication
router.use(authMiddleware);

router.post('/join-agency', appUserController.joinAgency);
router.post('/withdraw', appUserController.requestWithdrawal);

module.exports = router;