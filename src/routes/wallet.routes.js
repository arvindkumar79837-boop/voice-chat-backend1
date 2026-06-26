const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const auth = require('../middlewares/auth.middleware');
const adminAuth = require('../middlewares/isAdmin');

// ===================== USER WALLET =====================

// Main Wallet - 4 Core Wallets in one endpoint
router.get('/wallet', auth, walletController.getWallet);
router.get('/wallet/transactions', auth, walletController.getTransactionHistory);

// ===================== COIN WALLET - RECHARGE =====================

// Coin Recharge - Create Razorpay Order
router.post('/wallet/recharge/create-order', auth, walletController.createRazorpayOrder);

// Verify Payment
router.post('/wallet/recharge/verify', auth, walletController.verifyPayment);

// Webhook for Razorpay
router.post('/wallet/recharge/webhook', walletController.handlePaymentWebhook);

// ===================== SEND GIFT =====================

router.post('/wallet/gift/send', auth, walletController.sendGift);

// ===================== DIAMOND EXCHANGE =====================

// Wallet Exchange (Diamond to Coin)
router.post('/wallet/exchange', auth, walletController.exchangeDiamondsToCoins);

// ===================== DIAMOND WITHDRAWAL =====================

// Withdrawal Routes
router.post('/wallet/withdraw/request', auth, walletController.requestWithdrawal);
router.get('/wallet/withdraw/status', auth, walletController.getWithdrawalStatus);

// ===================== FAMILY WALLET =====================

// Family Wallet Routes
router.get('/wallet/family', auth, walletController.getFamilyWallet);
router.post('/wallet/family/contribute', auth, walletController.contributeToFamilyWallet);
router.post('/wallet/family/task-reward', auth, adminAuth, walletController.addFamilyTaskReward);
router.get('/wallet/family/transactions', auth, walletController.getFamilyWalletTransactions);

// ===================== AGENCY WALLET & COMMISSION =====================

// Agency Wallet Routes
router.get('/wallet/agency', auth, walletController.getAgencyWallet);
router.post('/wallet/agency/commission/credit', auth, adminAuth, walletController.creditAgencyCommission);
router.post('/wallet/agency/withdraw/request', auth, walletController.requestAgencyWithdrawal);
router.get('/wallet/agency/transactions', auth, walletController.getAgencyWalletTransactions);

// Agency Master Wallet - Host Dashboard
router.get('/wallet/agency/host-dashboard', auth, walletController.getHostAgencyDashboard);

// Agency Master Wallet - Owner Dashboard
router.get('/wallet/agency/owner-dashboard', auth, walletController.getOwnerAgencyDashboard);

// Agency Master Wallet - Monthly History
router.get('/wallet/agency/monthly-history', auth, walletController.getAgencyMonthlyHistory);

// Agency Master Wallet - Update Monthly Stats (Admin/System)
router.post('/wallet/agency/monthly-stats/update', auth, adminAuth, walletController.updateAgencyMonthlyStats);

// ===================== INCOME ANALYTICS =====================

// Income Analytics
router.get('/wallet/income-analytics', auth, walletController.getIncomeAnalytics);

// ===================== ADMIN ROUTES =====================

// Admin Routes - Withdrawal Management
router.get('/admin/withdrawals', auth, adminAuth, walletController.getAllWithdrawals);
router.get('/admin/withdrawals/:id', auth, adminAuth, walletController.getWithdrawalDetails);
router.put('/admin/withdrawals/:id/approve', auth, adminAuth, walletController.approveWithdrawal);
router.put('/admin/withdrawals/:id/reject', auth, adminAuth, walletController.rejectWithdrawal);
router.put('/admin/withdrawals/:id/process', auth, adminAuth, walletController.processWithdrawal);

// Admin Routes - Wallet Management
router.put('/admin/wallet/adjust', auth, adminAuth, walletController.adjustUserWallet);
router.get('/admin/wallet/stats', auth, adminAuth, walletController.getWalletStats);
router.get('/admin/wallet/config', auth, adminAuth, walletController.getWalletConfig);
router.put('/admin/wallet/config', auth, adminAuth, walletController.updateWalletConfig);

// Admin Routes - Transaction Management
router.get('/admin/transactions', auth, adminAuth, walletController.getAllTransactions);

// Admin Routes - Tax & Safety
router.get('/admin/wallet/tax-records', auth, adminAuth, walletController.getTaxRecords);
router.post('/admin/wallet/freeze', auth, adminAuth, walletController.freezeUserWallet);
router.post('/admin/wallet/unfreeze', auth, adminAuth, walletController.unfreezeUserWallet);

module.exports = router;