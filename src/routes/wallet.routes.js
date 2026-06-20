// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/routes/wallet.routes.js
// ARVIND PARTY - WALLET MANAGEMENT WITH RAZORPAY INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middlewares/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────
// ALL ROUTES REQUIRE AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────

router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────
// BALANCE & TRANSACTION ROUTES
// ─────────────────────────────────────────────────────────────────────────

/**
 * @route GET /api/wallet
 * @desc Get wallet balance and recent transactions
 * @access Private
 */
router.get('/', walletController.getWallet);

/**
 * @route GET /api/wallet/transactions
 * @desc Get transaction history with pagination
 * @access Private
 * @query page, limit
 */
router.get('/transactions', walletController.getTransactionHistory);

// ─────────────────────────────────────────────────────────────────────────
// RAZORPAY PAYMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/wallet/razorpay/order
 * @desc Create Razorpay order for recharge
 * @access Private
 * @body { amount: number, currency: string, packageId?: string }
 */
router.post('/razorpay/order', walletController.createRazorpayOrder);

/**
 * @route POST /api/wallet/razorpay/verify
 * @desc Verify Razorpay payment and add coins to wallet
 * @access Private
 * @body { orderId, paymentId, signature, amount, packageId }
 */
router.post('/razorpay/verify', walletController.verifyPayment);

/**
 * @route POST /api/wallet/razorpay/webhook
 * @desc Handle Razorpay webhook for payment updates
 * @access Public (but webhook signature verified)
 * @body { event, payload }
 */
router.post('/razorpay/webhook', walletController.handlePaymentWebhook);

// ─────────────────────────────────────────────────────────────────────────
// GIFT ROUTES
// ─────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/wallet/send-gift
 * @desc Send gift to another user
 * @access Private
 * @body { recipientId, giftId, quantity }
 */
router.post('/send-gift', walletController.sendGift);

// ─────────────────────────────────────────────────────────────────────────
// WITHDRAWAL ROUTES
// ─────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/wallet/withdraw
 * @desc Request withdrawal (for admin approval)
 * @access Private
 * @body { amount, paymentMethod }
 */
router.post('/withdraw', walletController.requestWithdrawal);

/**
 * @route GET /api/wallet/withdrawals
 * @desc Get withdrawal status and history
 * @access Private
 */
router.get('/withdrawals', walletController.getWithdrawalStatus);

module.exports = router;
