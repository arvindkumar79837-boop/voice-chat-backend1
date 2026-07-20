const mongoose = require('mongoose');
const User = require('../models/User');
const DealerWallet = require('../models/DealerWallet');
const WalletTransaction = require('../models/WalletTransaction');
const AuditLog = require('../models/AuditLog');
const CoinVault = require('../models/CoinVault');

const HIERARCHY_LEVELS = {
  owner: 4,
  merchant: 3,
  super_coin_seller: 2,
  normal_coin_seller: 1,
  user: 0,
};

const getLevel = (role) => {
  if (role === 'owner' || role === 'super_admin') return HIERARCHY_LEVELS.owner;
  if (role === 'merchant') return HIERARCHY_LEVELS.merchant;
  if (role === 'super_coin_seller') return HIERARCHY_LEVELS.super_coin_seller;
  if (role === 'normal_coin_seller' || role === 'coin_seller') return HIERARCHY_LEVELS.normal_coin_seller;
  return HIERARCHY_LEVELS.user;
};

exports.generateForUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { uid, amount, reason } = req.body;

    if (!uid || !amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'UID and valid amount required' });
    }

    const user = await User.findOne({ uid }).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const coinBefore = user.coins || 0;
    user.coins = coinBefore + amount;
    await user.save({ session });

    const balanceAfter = coinBefore + amount;

    await WalletTransaction.create([{
      userId: user._id,
      walletType: 'coin',
      type: 'admin_adjust',
      amount,
      description: reason || `Owner generated ${amount} coins for ${uid}`,
      balanceBefore: coinBefore,
      balanceAfter,
      status: 'completed',
      metadata: { generatedBy: 'OWNER', targetUid: uid },
    }], { session });

    await AuditLog.create([{
      action: 'COIN_GENERATE_FOR_USER',
      performedBy: req.user?.userId || 'OWNER',
      details: `Generated ${amount} coins for user ${uid}. Reason: ${reason || 'N/A'}`,
      metadata: { uid, amount, userNewBalance: balanceAfter },
    }], { session });

    await session.commitTransaction();
    return res.status(200).json({
      success: true,
      message: `${amount} coins generated for ${uid}`,
      data: { uid, amount, userNewBalance: balanceAfter },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Generate For User Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    session.endSession();
  }
};

exports.distributeCoins = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { fromUid, toUid, amount, reason } = req.body;

    if (!fromUid || !toUid || !amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'fromUid, toUid, and valid amount required' });
    }

    const fromUser = await User.findOne({ uid: fromUid }).session(session);
    if (!fromUser) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Sender not found' });
    }

    const toUser = await User.findOne({ uid: toUid }).session(session);
    if (!toUser) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const fromLevel = getLevel(fromUser.role);
    const toLevel = getLevel(toUser.role);

    if (fromLevel <= toLevel) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: `Transfer denied: sender level (${fromUser.role}) cannot transfer to same or higher level (${toUser.role})`,
      });
    }

    const fromBalance = fromUser.coins || 0;
    if (fromBalance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ${fromBalance}, Requested: ${amount}`,
      });
    }

    const fromBalanceAfter = fromBalance - amount;
    const toBalanceBefore = toUser.coins || 0;
    const toBalanceAfter = toBalanceBefore + amount;

    fromUser.coins = fromBalanceAfter;
    await fromUser.save({ session });

    toUser.coins = toBalanceAfter;
    await toUser.save({ session });

    const txHash = require('crypto').randomBytes(16).toString('hex');

    await WalletTransaction.create([
      {
        userId: fromUser._id,
        walletType: 'coin',
        type: 'admin_adjust',
        amount: -amount,
        description: reason || `Distributed ${amount} coins to ${toUid}`,
        balanceBefore: fromBalance,
        balanceAfter: fromBalanceAfter,
        status: 'completed',
        metadata: { type: 'DISTRIBUTION', fromUid, toUid, direction: 'out', txHash },
      },
      {
        userId: toUser._id,
        walletType: 'coin',
        type: 'admin_adjust',
        amount,
        description: reason || `Received ${amount} coins from ${fromUid}`,
        balanceBefore: toBalanceBefore,
        balanceAfter: toBalanceAfter,
        status: 'completed',
        metadata: { type: 'DISTRIBUTION', fromUid, toUid, direction: 'in', txHash },
      },
    ], { session });

    await AuditLog.create([{
      action: 'COIN_DISTRIBUTION',
      performedBy: req.user?.userId || 'OWNER',
      details: `${amount} coins: ${fromUid}(${fromUser.role}) → ${toUid}(${toUser.role})`,
      metadata: { fromUid, toUid, amount, fromRole: fromUser.role, toRole: toUser.role },
    }], { session });

    await session.commitTransaction();
    return res.status(200).json({
      success: true,
      message: `${amount} coins distributed from ${fromUid} to ${toUid}`,
      data: { fromUid, toUid, amount, fromNewBalance: fromBalanceAfter, toNewBalance: toBalanceAfter },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Distribute Coins Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    session.endSession();
  }
};
