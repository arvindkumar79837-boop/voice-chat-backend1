const express = require('express');
const router = express.Router();
const dealerController = require('../controllers/dealerController');
const { authMiddleware } = require('../middlewares/auth.middleware');
const isAdmin = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.use(authMiddleware);

router.post('/wallet/create', isAdmin, dealerController.createDealerWallet);
router.post('/wallet/credit', validateNumber('coins', { required: true, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), isAdmin, dealerController.creditDealerWallet);

router.get('/wallet/:dealerUid', validatePagination(), dealerController.getDealerWallet);
router.post('/transfer', validateBodyObjectId('userId'), validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), dealerController.transferCoinsToUser);
router.post('/refund/request', validateNumber('coins', { required: true, min: 0 }), dealerController.requestRefund);

router.get('/transactions/:dealerUid', validatePagination(), dealerController.getDealerTransactions);
router.get('/stats/:dealerUid', validatePagination(), dealerController.getDealerStats);
router.get('/list', validatePagination(), isAdmin, dealerController.getAllDealerWallets);

router.put('/level/:dealerUid', isAdmin, dealerController.updateDealerLevel);
router.put('/status/:dealerUid', isAdmin, dealerController.toggleDealerStatus);

router.post('/refund/:refundId/process', validateObjectId('refundId'), isAdmin, dealerController.processRefund);

module.exports = router;