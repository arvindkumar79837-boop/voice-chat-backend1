const express = require('express');
const router = express.Router();
const dealerController = require('../controllers/dealerController');
const authMiddleware = require('../middlewares/auth.middleware');
const isAdmin = require('../middlewares/isAdmin');

router.use(authMiddleware);

router.post('/wallet/create', isAdmin, dealerController.createDealerWallet);
router.post('/wallet/credit', isAdmin, dealerController.creditDealerWallet);

router.get('/wallet/:dealerUid', dealerController.getDealerWallet);
router.post('/transfer', dealerController.transferCoinsToUser);
router.post('/refund/request', dealerController.requestRefund);

router.get('/transactions/:dealerUid', dealerController.getDealerTransactions);
router.get('/stats/:dealerUid', dealerController.getDealerStats);
router.get('/list', isAdmin, dealerController.getAllDealerWallets);

router.put('/level/:dealerUid', isAdmin, dealerController.updateDealerLevel);
router.put('/status/:dealerUid', isAdmin, dealerController.toggleDealerStatus);

router.post('/refund/:refundId/process', isAdmin, dealerController.processRefund);

module.exports = router;