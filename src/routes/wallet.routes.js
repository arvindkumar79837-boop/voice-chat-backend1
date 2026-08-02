const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const walletController = require('../controllers/walletController');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBody, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

// ===================== USER WALLET =====================

// Main Wallet - 4 Core Wallets in one endpoint
router.get('/', validatePagination(), auth, asyncHandler(walletController.getWallet));
router.get('/transactions', validatePagination(), auth, asyncHandler(walletController.getTransactionHistory));

// ===================== COIN WALLET - RECHARGE =====================
// Coins are purchased via Google Play Billing:
// POST /api/economy/verify-google-play

// ===================== SEND GIFT =====================

router.post('/gift/send', auth, validateBodyObjectId('recipientId'), validateNumber('giftId', { required: true }), validateNumber('quantity', { required: true, min: 1 }), validateAllowedFields(['recipientId', 'giftId', 'quantity']), asyncHandler(walletController.sendGift));

// ===================== DIAMOND EXCHANGE =====================

// Wallet Exchange (Diamond to Coin)
router.post('/exchange', auth, validateNumber('diamondsToExchange', { required: true, min: 1 }), validateAllowedFields(['diamondsToExchange']), asyncHandler(walletController.exchangeDiamondsToCoins));

// ===================== DIAMOND WITHDRAWAL =====================

// Withdrawal Routes
router.post('/withdraw/request', auth, validateNumber('amount', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 1 }), validateAllowedFields(['amount', 'diamonds', 'paymentDetails']), asyncHandler(walletController.requestWithdrawal));
router.get('/withdraw/status', validatePagination(), auth, asyncHandler(walletController.getWithdrawalStatus));

// ===================== FAMILY WALLET =====================

// Family Wallet Routes
router.get('/family', validatePagination(), auth, asyncHandler(walletController.getFamilyWallet));
router.post('/family/contribute', auth, validateNumber('amount', { required: true, min: 1 }), validateAllowedFields(['amount']), asyncHandler(walletController.contributeToFamilyWallet));
router.post('/family/task-reward', auth, adminAuth, validateBodyObjectId('userId'), validateNumber('amount', { required: true, min: 0 }), validateAllowedFields(['userId', 'amount']), asyncHandler(walletController.addFamilyTaskReward));
router.get('/family/transactions', validatePagination(), auth, asyncHandler(walletController.getFamilyWalletTransactions));

// ===================== AGENCY WALLET & COMMISSION =====================

// Agency Wallet Routes
router.get('/agency', validatePagination(), auth, asyncHandler(walletController.getAgencyWallet));
router.post('/agency/commission/credit', auth, adminAuth, validateBodyObjectId('agencyId'), validateNumber('amount', { required: true, min: 0 }), validateAllowedFields(['agencyId', 'amount']), asyncHandler(walletController.creditAgencyCommission));
router.post('/agency/withdraw/request', auth, validateNumber('amount', { required: true, min: 1 }), validateAllowedFields(['amount']), asyncHandler(walletController.requestAgencyWithdrawal));
router.get('/agency/transactions', validatePagination(), auth, asyncHandler(walletController.getAgencyWalletTransactions));

// Agency Master Wallet - Host Dashboard
router.get('/agency/host-dashboard', validatePagination(), auth, asyncHandler(walletController.getHostAgencyDashboard));

// Agency Master Wallet - Owner Dashboard
router.get('/agency/owner-dashboard', validatePagination(), auth, asyncHandler(walletController.getOwnerAgencyDashboard));

// Agency Master Wallet - Monthly History
router.get('/agency/monthly-history', validatePagination(), auth, asyncHandler(walletController.getAgencyMonthlyHistory));

// Agency Master Wallet - Update Monthly Stats (Admin/System)
router.post('/agency/monthly-stats/update', auth, adminAuth, validateAllowedFields([]), asyncHandler(walletController.updateAgencyMonthlyStats));

// ===================== INCOME ANALYTICS =====================

// Income Analytics
router.get('/income-analytics', validatePagination(), auth, asyncHandler(walletController.getIncomeAnalytics));

// ===================== ADMIN ROUTES =====================

// Admin Routes - Withdrawal Management
router.get('/admin/withdrawals', validatePagination(), auth, adminAuth, asyncHandler(walletController.getAllWithdrawals));
router.get('/admin/withdrawals/:id', validatePagination(), auth, adminAuth, asyncHandler(walletController.getWithdrawalDetails));
router.put('/admin/withdrawals/:id/approve', validateObjectId('id'), auth, adminAuth, asyncHandler(walletController.approveWithdrawal));
router.put('/admin/withdrawals/:id/reject', validateObjectId('id'), auth, adminAuth, asyncHandler(walletController.rejectWithdrawal));
router.put('/admin/withdrawals/:id/process', validateObjectId('id'), auth, adminAuth, asyncHandler(walletController.processWithdrawal));

// Admin Routes - Wallet Management
router.put('/admin/wallet/adjust', auth, adminAuth, validateBodyObjectId('userId'), validateNumber('coins', { required: false, min: 0 }), validateNumber('diamonds', { required: false, min: 0 }), validateAllowedFields(['userId', 'coins', 'diamonds']), asyncHandler(walletController.adjustUserWallet));
router.get('/admin/wallet/stats', validatePagination(), auth, adminAuth, asyncHandler(walletController.getWalletStats));
router.get('/admin/wallet/config', validatePagination(), auth, adminAuth, asyncHandler(walletController.getWalletConfig));
router.put('/admin/wallet/config', auth, adminAuth, asyncHandler(walletController.updateWalletConfig));

// Admin Routes - Transaction Management
router.get('/admin/transactions', validatePagination(), auth, adminAuth, asyncHandler(walletController.getAllTransactions));

// Admin Routes - Tax & Safety
router.get('/admin/wallet/tax-records', validatePagination(), auth, adminAuth, asyncHandler(walletController.getTaxRecords));
router.post('/admin/wallet/freeze', auth, adminAuth, validateBodyObjectId('userId'), validateString('reason', { required: false, maxLength: 500 }), validateAllowedFields(['userId', 'reason']), asyncHandler(walletController.freezeUserWallet));
router.post('/admin/wallet/unfreeze', auth, adminAuth, validateBodyObjectId('userId'), validateAllowedFields(['userId']), asyncHandler(walletController.unfreezeUserWallet));

module.exports = router;