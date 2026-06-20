const User = require('../models/User'); // Pulls from your existing User Schema
const badgeController = require('./badgeController');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Transaction = require('../models/Transaction');

exports.updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update properties
    if (name) user.name = name;
    if (avatar) user.avatar = avatar; // We will accept Base64 string for now
    user.isProfileComplete = true;

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        avatar: user.avatar,
        isProfileComplete: user.isProfileComplete
      }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getUserCenter = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    // Try to check and award badges automatically
    try {
      await badgeController.checkAndAwardBadges(userId);
    } catch (error) {
      console.log('Badge system not available, using fallback badges');
    }

    // Try to get user badges with unlock status
    let badges = [];
    try {
      badges = await badgeController.getUserBadges(userId);
    } catch (error) {
      console.log('Using fallback badges');
      // Fallback badges when MongoDB is not available
      badges = [
        { id: 'b1', name: 'Top Gifter', description: 'Gifted over 10k diamonds', iconPath: '💎', isUnlocked: false },
        { id: 'b2', name: 'Coin Collector', description: 'Earned over 50k coins', iconPath: '💰', isUnlocked: false },
        { id: 'b3', name: 'Level Master', description: 'Reached level 10', iconPath: '🏆', isUnlocked: false },
        { id: 'b4', name: 'Early Bird', description: 'Joined Arvind Party', iconPath: '🐦', isUnlocked: true }
      ];
    }

    // Get frames (for now, using hardcoded frames)
    const frames = [
      { id: 'f1', name: 'Default Ring', imagePath: 'ring', isUnlocked: true, isEquipped: user?.equippedFrame === 'f1' },
      { id: 'f2', name: 'Gold Ring', imagePath: 'gold_ring', isUnlocked: user?.unlockedFrames.includes('f2'), isEquipped: user?.equippedFrame === 'f2' },
      { id: 'f3', name: 'Diamond Ring', imagePath: 'diamond_ring', isUnlocked: user?.unlockedFrames.includes('f3'), isEquipped: user?.equippedFrame === 'f3' }
    ];

    // Returning real structured response for the app to render dynamically
    res.status(200).json({
      levelInfo: { currentLevel: user?.level || 1, currentExp: 0, nextLevelExp: 100 },
      badges: badges,
      frames: frames
    });
  } catch (error) {
    console.error('User Center Error:', error);
    res.status(500).json({ error: 'Failed to load user center data' });
  }
};

exports.equipFrame = async (req, res) => {
  try {
    const { frameId } = req.body;
    const userId = req.user.userId;
    
    await User.findByIdAndUpdate(userId, { equippedFrame: frameId });
    
    res.status(200).json({ message: 'Frame equipped successfully', frameId });
  } catch (error) {
    console.error('Equip Frame Error:', error);
    res.status(500).json({ error: 'Failed to equip frame' });
  }
};

exports.getVipStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isVip = user.vipExpiry && new Date(user.vipExpiry) > new Date();
    
    res.status(200).json({
      vip: {
        isVip: isVip,
        level: isVip ? (user.vipLevel || 1) : 0,
        expiryDate: user.vipExpiry,
        perks: isVip ? ['Exclusive VIP Badge', 'Premium Entrance Effects', 'Special Chat Colors', 'Priority Support'] : []
      }
    });
  } catch (error) {
    console.error('VIP Status Error:', error);
    res.status(500).json({ error: 'Failed to load VIP status' });
  }
};

exports.createPaymentOrder = async (req, res) => {
  try {
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_SECRET',
    });

    const options = {
      amount: 50000, // Amount is in subunits (e.g., 50000 paise = ₹500)
      currency: 'INR',
      receipt: `receipt_${req.user.userId}_${Date.now()}`,
      notes: {
        userId: req.user.userId // Added so webhooks know who this payment belongs to
      }
    };

    const order = await instance.orders.create(options);
    res.status(200).json({ success: true, order_id: order.id, amount: order.amount });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.userId;

    // IMPORTANT: Replace this with your actual Razorpay Key Secret from environment variables!
    const secret = process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_SECRET';

    // Generate the expected signature
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Idempotency check: Ensure we don't grant VIP twice if webhook already processed it
      const existingTx = await Transaction.findOne({ razorpayOrderId: razorpay_order_id });
      if (existingTx && existingTx.status === 'SUCCESS') {
        return res.status(200).json({ success: true, message: 'Payment already verified & VIP granted' });
      }

      // Signature matches! Grant VIP status securely in the database
      const user = await User.findById(userId);
      
      const now = new Date();
      user.vipExpiry = new Date(now.setDate(now.getDate() + 30)); // Grant 30 days
      user.vipLevel = (user.vipLevel || 0) + 1; // Bump VIP level
      await user.save();

      // Record the successful transaction in the database
      const transaction = new Transaction({
        user: userId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: 50000, // Matches the amount created in createPaymentOrder
        type: 'VIP_UPGRADE',
        status: 'SUCCESS'
      });
      await transaction.save();

      return res.status(200).json({ success: true, message: 'Payment verified & VIP granted' });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Payment Verification Error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Find all transactions for this user and sort by newest first
    const transactions = await Transaction.find({ user: userId }).sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    console.error('Transaction History Error:', error);
    res.status(500).json({ error: 'Failed to load transaction history' });
  }
};

exports.razorpayWebhook = async (req, res) => {
  try {
    // Make sure to set this in your .env file!
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'YOUR_WEBHOOK_SECRET';
    const signature = req.headers['x-razorpay-signature'];

    // Use the raw body buffer if available, as JSON.stringify can alter formatting and break signatures!
    const payload = req.rawBody ? req.rawBody : JSON.stringify(req.body);

    // Generate the expected signature to ensure the request genuinely came from Razorpay
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload.payment.entity;
    const razorpay_order_id = paymentEntity.order_id;
    const razorpay_payment_id = paymentEntity.id;
    const userId = paymentEntity.notes?.userId; // Read the userId we injected earlier

    if (!userId) {
      return res.status(200).json({ success: true, message: 'Ignored: No userId found in notes' });
    }

    let transaction = await Transaction.findOne({ razorpayOrderId: razorpay_order_id });

    if (event === 'payment.captured' || event === 'order.paid') {
      if (!transaction) {
        // The Webhook beat the frontend app! Grant the user their VIP status.
        transaction = new Transaction({
          user: userId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          amount: paymentEntity.amount,
          type: 'VIP_UPGRADE',
          status: 'SUCCESS'
        });
        await transaction.save();

        const user = await User.findById(userId);
        if (user) {
          const now = new Date();
          user.vipExpiry = new Date(now.setDate(now.getDate() + 30));
          user.vipLevel = (user.vipLevel || 0) + 1;
          await user.save();

          // Emit real-time notification to the app via Socket.IO
          const io = req.app.get('io');
          if (io) {
            // If users join a room with their userId, use io.to(userId).emit(...)
            // Otherwise, emit globally and filter on the client side
            io.emit('webhook_payment_success', { userId: userId });
          }
        }
      }
    } else if (event === 'payment.failed' && transaction) {
      transaction.status = 'FAILED';
      await transaction.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};