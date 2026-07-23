const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const walletController = require('../controllers/walletController');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');
const { validateBody, validateObjectId } = require('../middlewares/validation.middleware');

// ===================== USER WALLET =====================

// Main Wallet - 4 Core Wallets in one endpoint
router.get('/wallet', auth, asyncHandler(walletController.getWallet));
router.get('/wallet/transactions', auth, asyncHandler(walletController.getTransactionHistory));

// ===================== COIN WALLET - RECHARGE =====================
// NOTE: Razorpay coin-purchase routes removed. Coins are purchased via
// Google Play Billing: POST /api/economy/verify-google-play

// ===================== SEND GIFT =====================

router.post('/wallet/gift/send', auth, validateBody({
  recipientId: { required: true },
  giftId: { required: true },
  quantity: { isNumeric: true }
}), asyncHandler(walletController.sendGift));

// ===================== DIAMOND EXCHANGE =====================

// Wallet Exchange (Diamond to Coin)
router.post('/wallet/exchange', auth, validateBody({
  diamondsToExchange: { required: true, isNumeric: true }
}), asyncHandler(walletController.exchangeDiamondsToCoins));

// ===================== DIAMOND WITHDRAWAL =====================

// Withdrawal Routes
router.post('/wallet/withdraw/request', auth, validateBody({
  amount: { isNumeric: true },
  diamonds: { isNumeric: true }
}), asyncHandler(walletController.requestWithdrawal));
router.get('/wallet/withdraw/status', auth, asyncHandler(walletController.getWithdrawalStatus));

// ===================== FAMILY WALLET =====================

// Family Wallet Routes
router.get('/wallet/family', auth, asyncHandler(walletController.getFamilyWallet));
router.post('/wallet/family/contribute', auth, asyncHandler(walletController.contributeToFamilyWallet));
router.post('/wallet/family/task-reward', auth, adminAuth, asyncHandler(walletController.addFamilyTaskReward));
router.get('/wallet/family/transactions', auth, asyncHandler(walletController.getFamilyWalletTransactions));

// ===================== AGENCY WALLET & COMMISSION =====================

// Agency Wallet Routes
router.get('/wallet/agency', auth, asyncHandler(walletController.getAgencyWallet));
router.post('/wallet/agency/commission/credit', auth, adminAuth, asyncHandler(walletController.creditAgencyCommission));
router.post('/wallet/agency/withdraw/request', auth, asyncHandler(walletController.requestAgencyWithdrawal));
router.get('/wallet/agency/transactions', auth, asyncHandler(walletController.getAgencyWalletTransactions));

// Agency Master Wallet - Host Dashboard
router.get('/wallet/agency/host-dashboard', auth, asyncHandler(walletController.getHostAgencyDashboard));

// Agency Master Wallet - Owner Dashboard
router.get('/wallet/agency/owner-dashboard', auth, asyncHandler(walletController.getOwnerAgencyDashboard));

// Agency Master Wallet - Monthly History
router.get('/wallet/agency/monthly-history', auth, asyncHandler(walletController.getAgencyMonthlyHistory));

// Agency Master Wallet - Update Monthly Stats (Admin/System)
router.post('/wallet/agency/monthly-stats/update', auth, adminAuth, asyncHandler(walletController.updateAgencyMonthlyStats));

// ===================== INCOME ANALYTICS =====================

// Income Analytics
router.get('/wallet/income-analytics', auth, asyncHandler(walletController.getIncomeAnalytics));

// ===================== ADMIN ROUTES =====================

// Admin Routes - Withdrawal Management
router.get('/admin/withdrawals', auth, adminAuth, asyncHandler(walletController.getAllWithdrawals));
router.get('/admin/withdrawals/:id', auth, adminAuth, asyncHandler(walletController.getWithdrawalDetails));
router.put('/admin/withdrawals/:id/approve', auth, adminAuth, asyncHandler(walletController.approveWithdrawal));
router.put('/admin/withdrawals/:id/reject', auth, adminAuth, asyncHandler(walletController.rejectWithdrawal));
router.put('/admin/withdrawals/:id/process', auth, adminAuth, asyncHandler(walletController.processWithdrawal));

// Admin Routes - Wallet Management
router.put('/admin/wallet/adjust', auth, adminAuth, asyncHandler(walletController.adjustUserWallet));
router.get('/admin/wallet/stats', auth, adminAuth, asyncHandler(walletController.getWalletStats));
router.get('/admin/wallet/config', auth, adminAuth, asyncHandler(walletController.getWalletConfig));
router.put('/admin/wallet/config', auth, adminAuth, asyncHandler(walletController.updateWalletConfig));

// Admin Routes - Transaction Management
router.get('/admin/transactions', auth, adminAuth, asyncHandler(walletController.getAllTransactions));

// Admin Routes - Tax & Safety
router.get('/admin/wallet/tax-records', auth, adminAuth, asyncHandler(walletController.getTaxRecords));
router.post('/admin/wallet/freeze', auth, adminAuth, asyncHandler(walletController.freezeUserWallet));
router.post('/admin/wallet/unfreeze', auth, adminAuth, asyncHandler(walletController.unfreezeUserWallet));

module.exports = router;