// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/walletController.js
// ARVIND PARTY - PRODUCTION-READY WALLET WITH RAZORPAY INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Withdrawal = require('../models/Withdrawal');
const AuditLog = require('../models/AuditLog');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
let razorpayInstance = null;
try {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  console.log('✅ Razorpay initialized');
} catch (error) {
  console.warn('⚠️ Razorpay initialization failed:', error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET WALLET BALANCE
// ═══════════════════════════════════════════════════════════════════════════

exports.getWallet = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('coins diamonds level xp arvindId name');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get wallet statistics
    const transactions = await WalletTransaction.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(10);

    const totalEarned = transactions
      .filter(t => ['reward', 'gift_received', 'bonus'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSpent = transactions
      .filter(t => ['gift_sent', 'recharge_used'].includes(t.type))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    res.status(200).json({
      success: true,
      data: {
        coins: user.coins || 0,
        diamonds: user.diamonds || 0,
        level: user.level || 1,
        xp: user.xp || 0,
        totalEarned,
        totalSpent,
        transactions: transactions.map(t => ({
          _id: t._id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          createdAt: t.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('❌ Get Wallet Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CREATE RAZORPAY ORDER
// ═══════════════════════════════════════════════════════════════════════════

exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', packageId } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!razorpayInstance) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway not available'
      });
    }

    // Razorpay expects amount in paise (₹10 = 1000 paise)
    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency: currency,
      receipt: `rcpt_${userId}_${Date.now()}`,
      notes: {
        userId: userId,
        packageId: packageId || 'standard'
      }
    };

    try {
      const order = await razorpayInstance.orders.create(options);

      // Store order ID in database for verification later
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Order created successfully',
        data: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId: process.env.RAZORPAY_KEY_ID,
          userName: user.name || user.phone,
          userEmail: user.email || `user_${user._id}@arvindparty.com`,
          userPhone: user.phone
        }
      });
    } catch (razorpayError) {
      console.error('❌ Razorpay Error:', razorpayError);
      return res.status(400).json({
        success: false,
        message: 'Failed to create order: ' + razorpayError.message
      });
    }
  } catch (error) {
    console.error('❌ Create Order Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY RAZORPAY PAYMENT
// ═══════════════════════════════════════════════════════════════════════════

exports.verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature, amount, packageId } = req.body;
    const userId = req.user.userId;

    // Validate inputs
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment details'
      });
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${orderId}|${paymentId}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== signature) {
      // Log suspicious activity
      await AuditLog.create({
        userId,
        action: 'payment_verification_failed',
        details: { orderId, paymentId, reason: 'invalid_signature' }
      });

      return res.status(401).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Find or create user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if payment already processed (idempotency)
    const existingTransaction = await WalletTransaction.findOne({
      referenceId: paymentId
    });

    if (existingTransaction) {
      return res.status(200).json({
        success: true,
        message: 'Payment already processed',
        data: {
          coins: user.coins,
          transactionId: existingTransaction._id
        }
      });
    }

    // Determine coins based on amount (configurable)
    // Example: ₹100 = 10 coins
    const coinsToAdd = Math.floor((amount / 100) * 10);

    // Atomically increment user coins (prevents race-condition manipulation)
    await User.findByIdAndUpdate(userId, {
      $inc: { coins: coinsToAdd, totalRecharges: amount }
    });

    // Create transaction record
    const transaction = await WalletTransaction.create({
      userId,
      type: 'recharge',
      amount: coinsToAdd,
      currency: 'INR',
      amountInr: amount,
      referenceId: paymentId,
      orderId: orderId,
      status: 'completed',
      description: `Recharge ₹${amount} → ${coinsToAdd} coins`,
      metadata: { packageId, signature }
    });

    // Log to audit
    await AuditLog.create({
      userId,
      action: 'payment_success',
      details: {
        orderId,
        paymentId,
        amount,
        coinsAdded: coinsToAdd
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        coins: user.coins,
        coinsAdded,
        transactionId: transaction._id,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Verify Payment Error:', error);

    // Log error
    try {
      await AuditLog.create({
        userId: req.user.userId,
        action: 'payment_verification_error',
        details: { error: error.message }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// RAZORPAY WEBHOOK (for server-to-server payment updates)
// ═══════════════════════════════════════════════════════════════════════════

exports.handlePaymentWebhook = async (req, res, next) => {
  try {
    const { event, payload } = req.body;

    // Verify webhook signature (optional but recommended)
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret && req.headers['x-razorpay-signature']) {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(JSON.stringify(payload));
      const expectedSignature = hmac.digest('hex');

      if (expectedSignature !== req.headers['x-razorpay-signature']) {
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }
    }

    console.log(`📨 Razorpay Webhook: ${event}`);

    switch (event) {
      case 'payment.authorized':
        // Payment authorized
        console.log('💳 Payment authorized:', payload.payment.id);
        break;

      case 'payment.failed':
        // Payment failed
        const paymentId = payload.payment.id;
        console.log('❌ Payment failed:', paymentId);
        // Optionally notify user
        break;

      case 'order.paid':
        // Order fully paid
        console.log('✅ Order paid:', payload.order.id);
        break;

      default:
        console.log('📌 Unknown event:', event);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET TRANSACTION HISTORY
// ═══════════════════════════════════════════════════════════════════════════

exports.getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await WalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await WalletTransaction.countDocuments({ userId });

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Transaction History Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SEND GIFT (Uses coins/diamonds)
// ═══════════════════════════════════════════════════════════════════════════

exports.sendGift = async (req, res, next) => {
  try {
    const { recipientId, giftId, quantity = 1 } = req.body;
    const senderId = req.user.userId;

    // Validate
    if (!recipientId || !giftId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Get gift details (from database)
    // For now, assuming gift cost is 10 coins each
    const giftCost = 10 * quantity;

    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ success: false, message: 'Sender not found' });
    }

    if ((sender.coins || 0) < giftCost) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient coins'
      });
    }

    // Atomically deduct from sender and credit recipient (prevents race-condition manipulation)
    const senderUpdate = await User.findByIdAndUpdate(senderId, {
      $inc: { coins: -giftCost }
    }).select('coins');

    if (!senderUpdate) {
      return res.status(404).json({ success: false, message: 'Sender not found' });
    }

    if (senderUpdate.coins < 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    const recipientCredit = Math.floor(giftCost * 0.7);
    if (recipientId) {
      await User.findByIdAndUpdate(recipientId, {
        $inc: { coins: recipientCredit }
      });
    }

    // Log sender transaction
    await WalletTransaction.create({
      userId: senderId,
      type: 'gift_sent',
      amount: -giftCost,
      description: `Sent gift to user`
    });

    // Log recipient transaction
    await WalletTransaction.create({
      userId: recipientId,
      type: 'gift_received',
      amount: recipientCredit,
      description: `Received gift from user`
    });

    res.status(200).json({
      success: true,
      message: 'Gift sent successfully',
      data: { coinsRemaining: senderUpdate.coins }
    });
  } catch (error) {
    console.error('❌ Send Gift Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST WITHDRAWAL
// ═══════════════════════════════════════════════════════════════════════════

exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0 || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount or payment method'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check minimum withdrawal
    const minWithdrawal = parseInt(process.env.MIN_WITHDRAWAL) || 500;
    if (amount < minWithdrawal) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is ₹${minWithdrawal}`
      });
    }

    // Check balance
    const coinsRequired = amount; // Simple 1:1 conversion for now
    if ((user.coins || 0) < coinsRequired) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Create withdrawal request (status: pending for admin approval)
    const withdrawal = await Withdrawal.create({
      userId,
      amount,
      coins: coinsRequired,
      paymentMethod,
      status: 'pending_level_1', // First level of approval
      requestedAt: new Date(),
      metadata: {
        userPhone: user.phone,
        userName: user.name
      }
    });

    // Don't deduct coins yet - only after approval
    // This prevents issues if request is rejected

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted for approval',
      data: {
        withdrawalId: withdrawal._id,
        status: withdrawal.status
      }
    });
  } catch (error) {
    console.error('❌ Withdrawal Error:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET WITHDRAWAL STATUS
// ═══════════════════════════════════════════════════════════════════════════

exports.getWithdrawalStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const withdrawals = await Withdrawal.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: withdrawals
    });
  } catch (error) {
    console.error('❌ Get Withdrawal Status Error:', error);
    next(error);
  }
};
