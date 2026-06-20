const express = require('express');
const router = express.Router();
const appUserController = require('../controllers/appUserController');

// App Users Routes
router.post('/join-agency', appUserController.joinAgency);
router.post('/withdraw', appUserController.requestWithdrawal);

module.exports = router;