const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const withdrawalController = require('../controllers/withdrawalController');

router.use(authMiddleware);

router.post('/withdrawal/request', withdrawalController.requestWithdrawal);
router.get('/withdrawal/history', withdrawalController.getWithdrawalHistory);
router.post('/withdrawal/approve/:id', withdrawalController.approveWithdrawal);
router.post('/withdrawal/reject/:id', withdrawalController.rejectWithdrawal);

module.exports = router;