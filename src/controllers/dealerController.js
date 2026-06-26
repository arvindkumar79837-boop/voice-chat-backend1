const mongoose = require('mongoose');
const User = require('../models/User');
const DealerWallet = require('../models/DealerWallet');
const DealerRefund = require('../models/DealerRefund');
const WalletTransaction = require('../models/WalletTransaction');
const AuditLog = require('../models/AuditLog');
const CoinVault = require('../models/CoinVault');
const crypto = require('crypto');

const generateTransactionHash = () => {
  return crypto.randomBytes(32).toString('hex');
};

const generateRefundId = () => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `REF-${timestamp}-${random}`.toUpperCase();
};

const resetDailyTransfers = async (dealerWallet) => {
  const today = new Date();
  const lastDate = dealerWallet.lastTransferDate ? new Date(dealerWallet.lastTransferDate) : null;
  
  if (!lastDate || lastDate.toDateString() !== today.toDateString()) {
    dealerWallet.dailyTransferCount = 0;
    dealerWallet.currentDailyTransfer = 0;
    dealerWallet.lastTransferDate = today;
    await dealerWallet.save();
  }
};

exports.createDealerWallet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { uid, level = 'silver', commissionPercent = 0, bonusPercent = 0, notes, assignedBy } = req.body;

    const user = await User.findOne({ uid }).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'User not found with this UID' });
    }

    if (user.role === 'coin_seller') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'User is already a coin seller' });
    }

    const existingWallet = await DealerWallet.findOne({ uid }).session(session);
    if (existingWallet) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Dealer wallet already exists for this UID' });
    }

    const levelConfig = {
      silver: { commission: 2, bonus: 0, dailyLimit: 500000, maxPerTx: 50000 },
      gold: { commission: 5, bonus: 0.5, dailyLimit: 2000000, maxPerTx: 200000 },
      diamond: { commission: 8, bonus: 1.5, dailyLimit: 10000000, maxPerTx: 500000 }
    };

    const config = levelConfig[level] || levelConfig.silver;

    const dealerWallet = new DealerWallet({
      userId: user._id,
      uid: user.uid,
      username: user.username,
      level,
      commissionPercent: commissionPercent || config.commission,
      bonusPercent: bonusPercent || config.bonus,
      dailyTransferLimit: config.dailyLimit,
      maxTransferPerTransaction: config.maxPerTx,
      notes: notes || '',
      assignedBy: assignedBy ? mongoose.Types.ObjectId(assignedBy) : null,
    });

    await dealerWallet.save({ session });
    user.role = 'coin_seller';
    user.isCoinSeller = true;
    await user.save({ session });

    await AuditLog.create({
      action: 'DEALER_WALLET_CREATED',
      performedBy: req.user?.userId || 'ADMIN',
      details: `Dealer wallet created for UID: ${uid}. Level: ${level}`,
      metadata: { dealerUid: uid, dealerWalletId: dealerWallet._id, level, commissionPercent: dealerWallet.commissionPercent }
    }, { session });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: 'Dealer wallet created successfully',
      data: dealerWallet
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Create Dealer Wallet Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    session.endSession();
  }
};

exports.getDealerWallet = async (req, res) => {
  try {
    const { dealerUid } = req.params;

    const dealerWallet = await DealerWallet.findOne({ uid: dealerUid, isActive: true });
    if (!dealerWallet) {
      return res.status(404).json({ success: false, message: 'Dealer wallet not found' });
    }

    await resetDailyTransfers(dealerWallet);

    const recentTransactions = await WalletTransaction.find({ userId: dealerWallet.userId })
      .sort({ createdAt: -1 })
      .limit(20);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTransactions = await WalletTransaction.find({
      userId: dealerWallet.userId,
      createdAt: { $gte: today },
      type: 'dealer_transfer_out'
    });

    const todayTransferred = todayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return res.status(200).json({
      success: true,
      data: {
        wallet: dealerWallet,
        recentTransactions,
        stats: {
          todayTransferred,
          remainingDailyLimit: dealerWallet.dailyTransferLimit - todayTransferred,
          totalTransactions: dealerWallet.totalTransactions,
          totalCustomersServed: dealerWallet.totalCustomersServed
        }
      }
    });
  } catch (error) {
    console.error('Get Dealer Wallet Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.transferCoinsToUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { targetUid, amount, reason, description } = req.body;
    const dealerUid = req.user?.uid;

    if (!targetUid || !amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Target UID and valid amount required' });
    }

    const dealer = await User.findOne({ uid: dealerUid }).session(session);
    if (!dealer || !dealer.isCoinSeller) {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Unauthorized: Coin seller access required' });
    }

    const dealerWallet = await DealerWallet.findOne({ userId: dealer._id, isActive: true }).session(session);
    if (!dealerWallet) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Dealer wallet not found' });
    }

    await resetDailyTransfers(dealerWallet);

    if (dealerWallet.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient dealer wallet balance. Available: ${dealerWallet.balance}, Requested: ${amount}`
      });
    }

    if (amount > dealerWallet.maxTransferPerTransaction) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Amount exceeds max per transaction: ${dealerWallet.maxTransferPerTransaction}`
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dealerWallet.lastTransferDate && new Date(dealerWallet.lastTransferDate) < today) {
      dealerWallet.currentDailyTransfer = 0;
    }

    if (dealerWallet.currentDailyTransfer + amount > dealerWallet.dailyTransferLimit) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Daily transfer limit exceeded. Today: ${dealerWallet.currentDailyTransfer}, Limit: ${dealerWallet.dailyTransferLimit}`
      });
    }

    const targetUser = await User.findOne({ uid: targetUid }).session(session);
    if (!targetUser) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    if (targetUser._id.toString() === dealer._id.toString()) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Cannot transfer coins to yourself' });
    }

    const transactionHash = generateTransactionHash();
    const transferDesc = description || `Coin transfer from dealer ${dealerUid} to ${targetUid}`;

    dealerWallet.balance -= amount;
    dealerWallet.totalTransferred += amount;
    dealerWallet.currentDailyTransfer += amount;
    dealerWallet.dailyTransferCount += 1;
    dealerWallet.lastTransferDate = new Date();
    dealerWallet.totalTransactions += 1;
    dealerWallet.totalCustomersServed += 1;
    await dealerWallet.save({ session });

    targetUser.coins = (targetUser.coins || 0) + amount;
    await targetUser.save({ session });

    const dealerTx = await WalletTransaction.create([{
      userId: dealer._id,
      type: 'dealer_transfer_out',
      amount: -amount,
      description: transferDesc,
      ref: targetUid,
      metadata: { transactionHash, dealerUid, targetUid, reason }
    }], { session });

    const userTx = await WalletTransaction.create([{
      userId: targetUser._id,
      type: 'dealer_transfer_in',
      amount: amount,
      description: `Received ${amount} coins from dealer ${dealerUid}`,
      ref: dealerUid,
      metadata: { transactionHash, dealerUid, targetUid, reason }
    }], { session });

    await AuditLog.create({
      action: 'DEALER_COIN_TRANSFER',
      performedBy: dealer._id,
      details: transferDesc,
      metadata: {
        transactionHash,
        dealerUid,
        targetUid,
        targetUserId: targetUser._id,
        amount,
        reason,
        dealerNewBalance: dealerWallet.balance,
        userNewBalance: targetUser.coins
      }
    }, { session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `${amount} coins transferred successfully to ${targetUid}`,
      data: {
        transactionHash,
        amountTransferred: amount,
        targetUid,
        targetUsername: targetUser.username,
        dealerNewBalance: dealerWallet.balance,
        userNewBalance: targetUser.coins,
        dealerTxId: dealerTx[0]._id,
        userTxId: userTx[0]._id,
        timestamp: new Date()
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Transfer Coins Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    session.endSession();
  }
};

exports.requestRefund = async (req, res) => {
  try {
    const { transactionHash, coinsToRefund, reason, errorDescription } = req.body;
    const dealerUid = req.user?.uid;

    if (!transactionHash || !coinsToRefund || coinsToRefund <= 0 || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Transaction hash, refund amount, and reason are required'
      });
    }

    const dealer = await User.findOne({ uid: dealerUid });
    if (!dealer || !dealer.isCoinSeller) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Coin seller access required' });
    }

    const dealerWallet = await DealerWallet.findOne({ userId: dealer._id, isActive: true });
    if (!dealerWallet) {
      return res.status(404).json({ success: false, message: 'Dealer wallet not found' });
    }

    const existingRefund = await DealerRefund.findOne({
      transactionHash,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRefund) {
      return res.status(400).json({
        success: false,
        message: 'A pending or approved refund already exists for this transaction'
      });
    }

    const targetUser = await User.findOne({ coins: { $gte: coinsToRefund } });
    const tx = await WalletTransaction.findOne({
      metadata: { transactionHash },
      type: 'dealer_transfer_in',
      userId: { $ne: dealer._id }
    }).sort({ createdAt: -1 });

    let targetUid = 'UNKNOWN';
    let targetUserId = null;
    if (tx) {
      targetUserId = tx.userId;
      const targetU = await User.findById(tx.userId);
      targetUid = targetU ? targetU.uid : 'UNKNOWN';
    }

    const refundId = generateRefundId();
    const refund = new DealerRefund({
      refundId,
      dealerWalletId: dealerWallet._id,
      dealerUid: dealerUid,
      dealerUsername: dealer.username,
      targetUserId: targetUserId,
      targetUid,
      transactionHash,
      coinsToRefund,
      reason,
      errorDescription: errorDescription || '',
      requestedBy: dealer._id,
      originalTransactionId: tx ? tx._id : null,
      status: 'pending'
    });

    await refund.save();

    await AuditLog.create({
      action: 'DEALER_REFUND_REQUESTED',
      performedBy: dealer._id,
      details: `Refund requested by dealer ${dealerUid}. Reason: ${reason}`,
      metadata: { refundId, transactionHash, coinsToRefund, targetUid }
    });

    return res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully',
      data: refund
    });
  } catch (error) {
    console.error('Request Refund Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.processRefund = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { refundId } = req.params;
    const { action, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid action. Use approve or reject.' });
    }

    const refund = await DealerRefund.findOne({ refundId }).session(session);
    if (!refund) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    if (refund.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Refund request already processed' });
    }

    if (action === 'reject') {
      refund.status = 'rejected';
      refund.processedBy = req.user?.userId;
      refund.processedAt = new Date();
      refund.processingNotes = notes || 'Rejected by finance manager';
      await refund.save({ session });

      await AuditLog.create({
        action: 'DEALER_REFUND_REJECTED',
        performedBy: req.user?.userId,
        details: `Refund ${refundId} rejected`,
        metadata: { refundId, transactionHash: refund.transactionHash }
      }, { session });

      await session.commitTransaction();
      return res.status(200).json({ success: true, message: 'Refund request rejected', data: refund });
    }

    const targetUser = await User.findById(refund.targetUserId).session(session);
    if (!targetUser) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    if ((targetUser.coins || 0) < refund.coinsToRefund) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Target user has insufficient balance. Available: ${targetUser.coins || 0}, Required: ${refund.coinsToRefund}`
      });
    }

    const dealer = await User.findById(refund.dealerWalletId).session(session);
    const dealerWallet = await DealerWallet.findById(refund.dealerWalletId).session(session);

    targetUser.coins -= refund.coinsToRefund;
    await targetUser.save({ session });

    refund.coinsDebitedFromUser = true;

    if (dealerWallet) {
      dealerWallet.balance += refund.coinsToRefund;
      dealerWallet.totalRefunded += refund.coinsToRefund;
      await dealerWallet.save({ session });
      refund.coinsCreditedToDealer = true;
    }

    refund.status = 'refunded';
    refund.processedBy = req.user?.userId;
    refund.processedAt = new Date();
    refund.processingNotes = notes || 'Refund approved and processed';
    await refund.save({ session });

    const refundHash = generateTransactionHash();
    refund.transactionHashResp = refundHash;
    await refund.save({ session });

    await WalletTransaction.create([{
      userId: refund.targetUserId,
      type: 'dealer_refund_debit',
      amount: -refund.coinsToRefund,
      description: `Refund to dealer ${refund.dealerUid} for transaction ${refund.transactionHash}`,
      ref: refund.refundId,
      metadata: { refundId, transactionHash: refund.transactionHash, dealerUid: refund.dealerUid }
    }, {
      userId: dealerWallet ? dealerWallet.userId : refund.dealerWalletId,
      type: 'dealer_refund_credit',
      amount: refund.coinsToRefund,
      description: `Refund received for transaction ${refund.transactionHash}`,
      ref: refund.refundId,
      metadata: { refundId, transactionHash: refund.transactionHash, targetUid: refund.targetUid }
    }], { session });

    await AuditLog.create({
      action: 'DEALER_REFUND_PROCESSED',
      performedBy: req.user?.userId,
      details: `Refund ${refundId} processed successfully`,
      metadata: {
        refundId,
        transactionHash: refund.transactionHash,
        coinsDebited: refund.coinsToRefund,
        coinsCredited: refund.coinsToRefund,
        targetUid: refund.targetUid,
        dealerUid: refund.dealerUid
      }
    }, { session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `Refund of ${refund.coinsToRefund} coins processed successfully`,
      data: {
        refundId: refund.refundId,
        refundHash,
        coinsRefunded: refund.coinsToRefund,
        targetUid: refund.targetUid,
        dealerUid: refund.dealerUid,
        status: refund.status,
        timestamp: refund.processedAt
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Process Refund Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    session.endSession();
  }
};

exports.getDealerTransactions = async (req, res) => {
  try {
    const { dealerUid } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const dealer = await User.findOne({ uid: dealerUid });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const transactions = await WalletTransaction.find({ userId: dealer._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await WalletTransaction.countDocuments({ userId: dealer._id });

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Get Dealer Transactions Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getDealerStats = async (req, res) => {
  try {
    const { dealerUid } = req.params;

    const dealer = await User.findOne({ uid: dealerUid });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const dealerWallet = await DealerWallet.findOne({ userId: dealer._id, isActive: true });
    if (!dealerWallet) {
      return res.status(404).json({ success: false, message: 'Dealer wallet not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTransfers = await WalletTransaction.find({
      userId: dealer._id,
      createdAt: { $gte: today },
      type: 'dealer_transfer_out'
    });
    const todayVolume = todayTransfers.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const monthTransfers = await WalletTransaction.find({
      userId: dealer._id,
      createdAt: { $gte: thisMonth },
      type: 'dealer_transfer_out'
    });
    const monthVolume = monthTransfers.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const pendingRefunds = await DealerRefund.countDocuments({
      dealerUid,
      status: 'pending'
    });

    const successRate = dealerWallet.totalTransactions > 0
      ? ((dealerWallet.totalTransactions - dealerWallet.totalRefunded) / dealerWallet.totalTransactions * 100)
      : 100;

    return res.status(200).json({
      success: true,
      data: {
        dealerInfo: {
          uid: dealer.uid,
          username: dealer.username,
          level: dealerWallet.level,
          commissionPercent: dealerWallet.commissionPercent,
          bonusPercent: dealerWallet.bonusPercent,
          isVerified: dealerWallet.isVerified,
          createdAt: dealerWallet.createdAt
        },
        wallet: {
          currentBalance: dealerWallet.balance,
          totalReceived: dealerWallet.totalReceived,
          totalTransferred: dealerWallet.totalTransferred,
          totalRefunded: dealerWallet.totalRefunded,
          totalTransactions: dealerWallet.totalTransactions,
          totalCustomersServed: dealerWallet.totalCustomersServed
        },
        today: {
          transfersCount: todayTransfers.length,
          volume: todayVolume,
          remainingLimit: dealerWallet.dailyTransferLimit - dealerWallet.currentDailyTransfer
        },
        month: {
          volume: monthVolume
        },
        refunds: {
          pending: pendingRefunds
        },
        performance: {
          successRate: successRate.toFixed(2),
          averageTransactionSize: dealerWallet.totalTransactions > 0
            ? Math.round(dealerWallet.totalTransferred / dealerWallet.totalTransactions)
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Get Dealer Stats Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getAllDealerWallets = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.level) filter.level = req.query.level;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.isFlagged !== undefined) filter.isFlagged = req.query.isFlagged === 'true';
    if (req.query.isVerified !== undefined) filter.isVerified = req.query.isVerified === 'true';

    const dealers = await DealerWallet.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DealerWallet.countDocuments(filter);

    let activeCount, flaggedCount, verifiedCount, totalBalance;
    try {
      activeCount = await DealerWallet.countDocuments({ isActive: true });
      flaggedCount = await DealerWallet.countDocuments({ isFlagged: true });
      verifiedCount = await DealerWallet.countDocuments({ isVerified: true });
      const agg = await DealerWallet.aggregate([
        { $group: { _id: null, totalBalance: { $sum: '$balance' } } }
      ]);
      totalBalance = agg.length > 0 ? agg[0].totalBalance : 0;
    } catch (e) {
      activeCount = dealers.filter(d => d.isActive).length;
      flaggedCount = dealers.filter(d => d.isFlagged).length;
      verifiedCount = dealers.filter(d => d.isVerified).length;
      totalBalance = dealers.reduce((sum, d) => sum + d.balance, 0);
    }

    return res.status(200).json({
      success: true,
      data: {
        dealers,
        stats: {
          totalDealers: total,
          activeDealers: activeCount,
          flaggedDealers: flaggedCount,
          verifiedDealers: verifiedCount,
          totalBalance
        },
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Get All Dealers Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updateDealerLevel = async (req, res) => {
  try {
    const { dealerUid } = req.params;
    const { level, commissionPercent, bonusPercent, notes } = req.body;

    const dealerWallet = await DealerWallet.findOne({ uid: dealerUid });
    if (!dealerWallet) {
      return res.status(404).json({ success: false, message: 'Dealer wallet not found' });
    }

    const levelConfig = {
      silver: { commission: 2, bonus: 0, dailyLimit: 500000, maxPerTx: 50000 },
      gold: { commission: 5, bonus: 0.5, dailyLimit: 2000000, maxPerTx: 200000 },
      diamond: { commission: 8, bonus: 1.5, dailyLimit: 10000000, maxPerTx: 500000 }
    };

    const config = levelConfig[level] || levelConfig.silver;
    if (level) dealerWallet.level = level;
    if (commissionPercent !== undefined) dealerWallet.commissionPercent = commissionPercent;
    if (bonusPercent !== undefined) dealerWallet.bonusPercent = bonusPercent;
    if (notes !== undefined) dealerWallet.notes = notes;

    if (level && levelConfig[level]) {
      dealerWallet.commissionPercent = dealerWallet.commissionPercent || config.commission;
      dealerWallet.bonusPercent = dealerWallet.bonusPercent || config.bonus;
      dealerWallet.dailyTransferLimit = config.dailyLimit;
      dealerWallet.maxTransferPerTransaction = config.maxPerTx;
    }

    await dealerWallet.save();

    const user = await User.findById(dealerWallet.userId);
    if (user) {
      user.coinSellerLevel = level;
      user.coinSellerCommission = dealerWallet.commissionPercent;
      await user.save();
    }

    await AuditLog.create({
      action: 'DEALER_LEVEL_UPDATED',
      performedBy: req.user?.userId || 'ADMIN',
      details: `Dealer ${dealerUid} level updated to ${level}`,
      metadata: { dealerUid, level, commissionPercent: dealerWallet.commissionPercent }
    });

    return res.status(200).json({
      success: true,
      message: `Dealer level updated to ${level}`,
      data: dealerWallet
    });
  } catch (error) {
    console.error('Update Dealer Level Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.toggleDealerStatus = async (req, res) => {
  try {
    const { dealerUid } = req.params;
    const { isActive, notes } = req.body;

    const dealerWallet = await DealerWallet.findOne({ uid: dealerUid });
    if (!dealerWallet) {
      return res.status(404).json({ success: false, message: 'Dealer wallet not found' });
    }

    dealerWallet.isActive = isActive;
    if (notes) dealerWallet.notes = dealerWallet.notes
      ? `${dealerWallet.notes}\n[${new Date().toISOString()}] ${notes}`
      : notes;
    await dealerWallet.save();

    const user = await User.findById(dealerWallet.userId);
    if (user) {
      if (!isActive) {
        user.role = 'user';
        user.isCoinSeller = false;
      } else {
        user.role = 'coin_seller';
        user.isCoinSeller = true;
      }
      await user.save();
    }

    await AuditLog.create({
      action: isActive ? 'DEALER_ACTIVATED' : 'DEALER_DEACTIVATED',
      performedBy: req.user?.userId || 'ADMIN',
      details: `Dealer ${dealerUid} ${isActive ? 'activated' : 'deactivated'}`,
      metadata: { dealerUid, isActive }
    });

    return res.status(200).json({
      success: true,
      message: `Dealer ${dealerUid} ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: dealerWallet
    });
  } catch (error) {
    console.error('Toggle Dealer Status Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.creditDealerWallet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { dealerUid, amount, reason, description } = req.body;

    if (!dealerUid || !amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Dealer UID and valid amount required' });
    }

    const dealerWallet = await DealerWallet.findOne({ uid: dealerUid, isActive: true }).session(session);
    if (!dealerWallet) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Active dealer wallet not found' });
    }

    const vault = await CoinVault.getVault();
    const sessionVault = await mongoose.model('CoinVault').findById(vault._id).session(session);
    if (sessionVault.currentBalance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient vault balance. Available: ${sessionVault.currentBalance}, Requested: ${amount}`
      });
    }

    sessionVault.currentBalance -= amount;
    sessionVault.totalCoinsDispatched += amount;
    sessionVault.lastDispatchDate = new Date();
    sessionVault.dispatchHistory.push({
      amount,
      targetSellerUid: dealerUid,
      dispatchedBy: req.user?.userId || 'ADMIN',
      dispatchedAt: new Date(),
      status: 'completed'
    });
    await sessionVault.save({ session });

    dealerWallet.balance += amount;
    dealerWallet.totalReceived += amount;
    await dealerWallet.save({ session });

    await WalletTransaction.create([{
      userId: dealerWallet.userId,
      type: 'dealer_wallet_credit',
      amount: amount,
      description: description || `Bulk credit to dealer ${dealerUid}. Reason: ${reason || 'N/A'}`,
      metadata: { dealerUid, reason, fromVault: true }
    }], { session });

    await AuditLog.create({
      action: 'DEALER_WALLET_CREDITED',
      performedBy: req.user?.userId || 'ADMIN',
      details: `Credited ${amount} coins to dealer ${dealerUid}`,
      metadata: { dealerUid, amount, reason, vaultBalance: sessionVault.currentBalance }
    }, { session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `${amount} coins credited to dealer ${dealerUid}`,
      data: {
        amount,
        dealerUid,
        newBalance: dealerWallet.balance,
        vaultBalance: sessionVault.currentBalance
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Credit Dealer Wallet Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    session.endSession();
  }
};