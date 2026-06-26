const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Withdrawal = require('../models/Withdrawal');
const WalletConfig = require('../models/WalletConfig');
const FamilyWallet = require('../models/FamilyWallet');
const AgencyWallet = require('../models/AgencyWallet');
const Agency = require('../models/Agency');
const Family = require('../models/Family');
const IncomeAnalytics = require('../models/IncomeAnalytics');
const AuditLog = require('../models/AuditLog');
const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpayInstance = null;
try {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} catch (error) {
  console.warn('Razorpay initialization failed:', error.message);
}

const DEFAULT_CONFIG = {
  diamondToCoinRate: 10,
  minWithdrawal: 500,
  coinPackageRate: 10,
  exchangeRate: 100,
  taxPercentage: 5,
  agencyCommissionRate: 0.1,
  familyTaskRewardRate: 0.5,
  dailyRewardCoins: 10,
  authorizedRoles: ['owner', 'super_admin', 'global_manager', 'admin', 'coin_seller', 'agency_owner']
};

const getWalletConfig = async () => {
  const config = await WalletConfig.findOne({ configKey: 'wallet_settings' });
  if (!config) {
    const newConfig = await WalletConfig.create({
      configKey: 'wallet_settings',
      configValue: DEFAULT_CONFIG,
      description: 'Wallet and exchange configuration for all 4 wallets'
    });
    return newConfig.configValue;
  }
  return config.configValue;
};

const logTransaction = async (userId, walletType, type, amount, description, metadata = {}) => {
  const transaction = await WalletTransaction.create({
    userId,
    walletType,
    type,
    amount,
    description,
    ...metadata,
    status: 'completed'
  });
  return transaction;
};

const createAuditLog = async (userId, action, details = {}) => {
  try {
    await AuditLog.create({ userId, action, details });
  } catch (error) {
    console.error('Audit log creation failed:', error);
  }
};

const updateIncomeAnalytics = async (userId, walletType, type, amount, config) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const dateStr = new Date(year, month - 1, day);
    
    let analytics = await IncomeAnalytics.findOne({ userId, date: dateStr, day, month, year });
    if (!analytics) {
      const user = await User.findById(userId).select('coins diamonds');
      analytics = new IncomeAnalytics({
        userId, date: dateStr, day, month, year,
        coinWallet: { opening: user?.coins || 0 },
        diamondWallet: { opening: user?.diamonds || 0 }
      });
    }

    const absAmount = Math.abs(amount);
    const isCredit = amount > 0;
    const taxPct = config.taxPercentage || 0;
    const taxAmt = isCredit ? 0 : Math.floor(absAmount * taxPct / 100);

    if (walletType === 'coin') {
      if (isCredit) {
        if (type === 'recharge') analytics.coinWallet.recharge += absAmount;
        else if (type === 'reward' || type === 'daily_task_reward' || type === 'login_streak_reward' || type === 'event_reward') analytics.coinWallet.reward += absAmount;
        else if (type === 'gift_received') analytics.coinWallet.giftReceived += absAmount;
        else if (type === 'exchange_in') analytics.coinWallet.exchangeIn += absAmount;
        else if (type === 'task_earned') analytics.coinWallet.taskEarned += absAmount;
        else if (type === 'refund') analytics.coinWallet.refund += absAmount;
        analytics.coinWallet.totalCredited += absAmount;
      } else {
        if (type === 'gift_sent') analytics.coinWallet.giftSent += absAmount;
        else if (type === 'exchange_out') analytics.coinWallet.exchangeOut += absAmount;
        else if (type === 'admin_adjust') analytics.coinWallet.adminAdjust += absAmount;
        analytics.coinWallet.totalDebited += absAmount;
      }
      if (type === 'admin_adjust' && !isCredit) analytics.coinWallet.adminAdjust += absAmount;
      analytics.coinWallet.closing = analytics.coinWallet.opening + analytics.coinWallet.totalCredited - analytics.coinWallet.totalDebited;
    } else if (walletType === 'diamond') {
      if (isCredit) {
        if (type === 'gift_received') analytics.diamondWallet.giftReceived += absAmount;
        else if (type === 'bonus') analytics.diamondWallet.bonus += absAmount;
        analytics.diamondWallet.totalCredited += absAmount;
      } else {
        if (type === 'exchange_out') analytics.diamondWallet.exchangeOut += absAmount;
        else if (type === 'withdrawal') analytics.diamondWallet.withdrawal += absAmount;
        else if (type === 'admin_adjust') analytics.diamondWallet.adminAdjust += absAmount;
        analytics.diamondWallet.totalDebited += absAmount;
      }
      analytics.diamondWallet.closing = analytics.diamondWallet.opening + analytics.diamondWallet.totalCredited - analytics.diamondWallet.totalDebited;
    } else if (walletType === 'family') {
      if (isCredit) {
        if (type === 'family_task_reward') analytics.familyWallet.taskEarned += absAmount;
        else if (type === 'reward') analytics.familyWallet.rewardEarned += absAmount;
        else if (type === 'family_contribution') analytics.familyWallet.contribution += absAmount;
      }
    } else if (walletType === 'agency') {
      if (isCredit) {
        if (type === 'agency_commission') analytics.agencyWallet.commissionEarned += absAmount;
        else if (type === 'agency_host_earning') analytics.agencyWallet.hostEarnings += absAmount;
      } else {
        if (type === 'agency_withdrawal') analytics.agencyWallet.withdrawal += absAmount;
      }
    }

    if (!isCredit && taxAmt > 0) {
      analytics.summary.taxDeducted += taxAmt;
    }
    analytics.summary.totalIncome += isCredit ? absAmount : 0;
    analytics.summary.totalExpense += !isCredit ? absAmount : 0;
    analytics.summary.netChange = analytics.summary.totalIncome - analytics.summary.totalExpense;
    
    await analytics.save();
  } catch (error) {
    console.error('Income analytics update failed:', error);
  }
};

// ===================== COIN WALLET =====================

exports.getWallet = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('coins diamonds level xp arvindId name uid role isCoinSeller coinSellerLevel familyId agencyId');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let familyCoinBalance = 0;
    let familyDiamondBalance = 0;
    if (user.familyId) {
      const familyWallet = await FamilyWallet.findOne({ familyId: user.familyId });
      if (familyWallet) {
        familyCoinBalance = familyWallet.totalCoins;
        familyDiamondBalance = familyWallet.totalDiamonds;
      }
    }

    let agencyBalance = 0;
    let agencyPendingWithdrawal = 0;
    let agencyTotalEarnings = 0;
    if (user.agencyId || user.role === 'agency_owner') {
      const agencyQuery = user.role === 'agency_owner' 
        ? { agencyId: user.agencyId }
        : { agencyId: user.agencyId };
      const aWallet = await AgencyWallet.findOne(agencyQuery);
      if (aWallet) {
        agencyBalance = aWallet.balance;
        agencyPendingWithdrawal = aWallet.pendingWithdrawal;
        agencyTotalEarnings = aWallet.totalEarnings;
      }
    }

    const pendingWithdrawals = await Withdrawal.countDocuments({
      userId: req.user.userId,
      status: { $in: ['PENDING', 'PROCESSING'] }
    });

    const config = await getWalletConfig();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIncome = await IncomeAnalytics.findOne({
      userId: req.user.userId,
      date: today
    });

    res.status(200).json({
      success: true,
      data: {
        coins: user.coins || 0,
        diamonds: user.diamonds || 0,
        level: user.level || 1,
        xp: user.xp || 0,
        pendingWithdrawals,
        role: user.role,
        isCoinSeller: user.isCoinSeller,
        coinSellerLevel: user.coinSellerLevel,
        userUid: user.uid,
        arvindId: user.arvindId,
        familyId: user.familyId,
        agencyId: user.agencyId,
        familyWallet: {
          coins: familyCoinBalance,
          diamonds: familyDiamondBalance
        },
        agencyWallet: {
          balance: agencyBalance,
          pendingWithdrawal: agencyPendingWithdrawal,
          totalEarnings: agencyTotalEarnings
        },
        todayIncome: {
          total: todayIncome?.summary?.totalIncome || 0,
          expense: todayIncome?.summary?.totalExpense || 0,
          netChange: todayIncome?.summary?.netChange || 0,
          taxDeducted: todayIncome?.summary?.taxDeducted || 0
        },
        config: {
          exchangeRate: config.exchangeRate,
          coinPackageRate: config.coinPackageRate,
          minWithdrawal: config.minWithdrawal,
          taxPercentage: config.taxPercentage
        }
      }
    });
  } catch (error) {
    console.error('Get Wallet Error:', error);
    next(error);
  }
};

// ===================== RECHARGE (Coin Wallet) =====================

exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', packageId } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (!razorpayInstance) {
      return res.status(500).json({ success: false, message: 'Payment gateway not available' });
    }

    const amountInPaise = Math.round(amount * 100);
    const config = await getWalletConfig();
    const coinsToAdd = Math.floor(amount * config.coinPackageRate);

    const options = {
      amount: amountInPaise,
      currency,
      receipt: `rcpt_${userId}_${Date.now()}`,
      notes: {
        userId,
        packageId: packageId || 'standard',
        coinsToAdd
      }
    };

    const order = await razorpayInstance.orders.create(options);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        coinsToAdd,
        userName: user.name || user.phone,
        userEmail: user.email || `user_${user._id}@arvindparty.com`,
        userPhone: user.phone
      }
    });
  } catch (error) {
    console.error('Create Order Error:', error);
    next(error);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature, amount, packageId } = req.body;
    const userId = req.user.userId;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${orderId}|${paymentId}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== signature) {
      await createAuditLog(userId, 'payment_verification_failed', { orderId, paymentId, reason: 'invalid_signature' });
      return res.status(401).json({ success: false, message: 'Payment verification failed' });
    }

    const existingTransaction = await WalletTransaction.findOne({ referenceId: paymentId });
    if (existingTransaction) {
      const user = await User.findById(userId);
      return res.status(200).json({
        success: true,
        message: 'Payment already processed',
        data: { coins: user.coins, transactionId: existingTransaction._id }
      });
    }

    const config = await getWalletConfig();
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const coinsToAdd = Math.floor(amount * config.coinPackageRate);
    const coinBefore = user.coins || 0;
    await User.findByIdAndUpdate(userId, { $inc: { coins: coinsToAdd } });
    
    const txn = await logTransaction(userId, 'coin', 'recharge', coinsToAdd, `Recharge ₹${amount} = ${coinsToAdd} coins`, {
      balanceBefore: coinBefore,
      balanceAfter: coinBefore + coinsToAdd,
      referenceId: paymentId,
      orderId, paymentId, packageId, amountInr: amount
    });

    await updateIncomeAnalytics(userId, 'coin', 'recharge', coinsToAdd, config);
    await createAuditLog(userId, 'payment_success', { orderId, paymentId, amount, coinsAdded: coinsToAdd });

    const updatedUser = await User.findById(userId);
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: { coins: updatedUser.coins, coinsAdded: coinsToAdd, transactionId: txn._id, timestamp: new Date() }
    });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    try {
      await createAuditLog(req.user.userId, 'payment_verification_error', { error: error.message });
    } catch (logError) { console.error('Failed to log error:', logError); }
    next(error);
  }
};

exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { event, payload } = req.body;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret && req.headers['x-razorpay-signature']) {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(JSON.stringify(payload));
      const expectedSignature = hmac.digest('hex');
      if (expectedSignature !== req.headers['x-razorpay-signature']) {
        return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      }
    }
    console.log(`Razorpay Webhook: ${event}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

// ===================== TRANSACTION HISTORY =====================

exports.getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const walletType = req.query.walletType;

    const query = { userId };
    if (walletType) query.walletType = walletType;

    const transactions = await WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await WalletTransaction.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Transaction History Error:', error);
    next(error);
  }
};

// ===================== FAMILY WALLET =====================

exports.getFamilyWallet = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('familyId uid');
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'No family found for this user' });
    }

    let familyWallet = await FamilyWallet.findOne({ familyId: user.familyId });
    if (!familyWallet) {
      familyWallet = await FamilyWallet.create({ familyId: user.familyId });
    }

    const family = await Family.findById(user.familyId).select('family_name family_badge current_level total_xp member_count');
    const memberDetails = await User.find({
      _id: { $in: familyWallet.memberContributions.map(m => m.userId) }
    }).select('uid name avatar username');

    const contributionMap = {};
    for (const member of memberDetails) {
      contributionMap[member._id.toString()] = { uid: member.uid, name: member.name, avatar: member.avatar, username: member.username };
    }

    const enrichedContributions = familyWallet.memberContributions.map(m => ({
      ...m.toObject(),
      userDetails: contributionMap[m.userId?.toString()] || {}
    }));

    res.status(200).json({
      success: true,
      data: {
        family: family ? {
          name: family.family_name,
          badge: family.family_badge,
          level: family.current_level,
          xp: family.total_xp,
          memberCount: family.member_count
        } : null,
        wallet: {
          totalCoins: familyWallet.totalCoins,
          totalDiamonds: familyWallet.totalDiamonds,
          taskCoinsEarned: familyWallet.taskCoinsEarned,
          rewardCoins: familyWallet.rewardCoins,
          weeklyEarned: familyWallet.weeklyEarned,
          monthlyEarned: familyWallet.monthlyEarned,
          isFrozen: familyWallet.isFrozen
        },
        contributions: enrichedContributions
      }
    });
  } catch (error) {
    console.error('Get Family Wallet Error:', error);
    next(error);
  }
};

exports.contributeToFamilyWallet = async (req, res, next) => {
  try {
    const { coins = 0, diamonds = 0 } = req.body;
    const userId = req.user.userId;

    if (coins <= 0 && diamonds <= 0) {
      return res.status(400).json({ success: false, message: 'Contribution amount must be positive' });
    }

    const user = await User.findById(userId).select('coins diamonds familyId uid name');
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'No family found' });
    }

    if ((user.coins || 0) < coins) {
      return res.status(400).json({ success: false, message: 'Insufficient coins' });
    }
    if ((user.diamonds || 0) < diamonds) {
      return res.status(400).json({ success: false, message: 'Insufficient diamonds' });
    }

    let familyWallet = await FamilyWallet.findOne({ familyId: user.familyId });
    if (!familyWallet) {
      familyWallet = await FamilyWallet.create({ familyId: user.familyId });
    }

    const memberIndex = familyWallet.memberContributions.findIndex(
      m => m.userId.toString() === userId
    );

    if (memberIndex >= 0) {
      familyWallet.memberContributions[memberIndex].coinsContributed += coins;
      familyWallet.memberContributions[memberIndex].diamondsContributed += diamonds;
      familyWallet.memberContributions[memberIndex].lastContributedAt = new Date();
    } else {
      familyWallet.memberContributions.push({
        userId,
        uid: user.uid,
        coinsContributed: coins,
        diamondsContributed: diamonds,
        tasksCompleted: 0,
        lastContributedAt: new Date()
      });
    }

    familyWallet.totalCoins += coins;
    familyWallet.totalDiamonds += diamonds;
    await familyWallet.save();

    if (coins > 0) {
      await User.findByIdAndUpdate(userId, { $inc: { coins: -coins, familyContribution: coins } });
      await logTransaction(userId, 'coin', 'family_contribution', -coins, `Contributed ${coins} coins to family wallet`, {
        familyId: user.familyId
      });
    }
    if (diamonds > 0) {
      await User.findByIdAndUpdate(userId, { $inc: { diamonds: -diamonds, familyContribution: diamonds } });
      await logTransaction(userId, 'diamond', 'family_contribution', -diamonds, `Contributed ${diamonds} diamonds to family wallet`, {
        familyId: user.familyId
      });
    }

    const config = await getWalletConfig();
    await updateIncomeAnalytics(userId, 'family', 'family_contribution', -(coins + diamonds), config);

    const updatedUser = await User.findById(userId).select('coins diamonds');
    res.status(200).json({
      success: true,
      message: 'Contribution successful',
      data: {
        coinsRemaining: updatedUser.coins,
        diamondsRemaining: updatedUser.diamonds,
        familyWallet: familyWallet
      }
    });
  } catch (error) {
    console.error('Contribute to Family Wallet Error:', error);
    next(error);
  }
};

exports.addFamilyTaskReward = async (req, res, next) => {
  try {
    const { familyId, taskCoins = 0, taskDiamonds = 0, description = 'Family task reward' } = req.body;
    const adminId = req.user.userId;

    let familyWallet = await FamilyWallet.findOne({ familyId });
    if (!familyWallet) {
      familyWallet = await FamilyWallet.create({ familyId });
    }

    familyWallet.totalCoins += taskCoins;
    familyWallet.totalDiamonds += taskDiamonds;
    familyWallet.taskCoinsEarned += taskCoins;
    familyWallet.weeklyEarned += taskCoins + taskDiamonds;
    familyWallet.monthlyEarned += taskCoins + taskDiamonds;
    await familyWallet.save();

    const family = await Family.findById(familyId).select('members_list family_name');
    if (family && family.members_list) {
      const members = await User.find({ uid: { $in: family.members_list } }).select('_id');
      for (const member of members) {
        await logTransaction(member._id, 'family', 'family_task_reward', taskCoins || taskDiamonds, description, {
          familyId,
          awardedBy: adminId
        });
        await updateIncomeAnalytics(member._id, 'family', 'family_task_reward', taskCoins || taskDiamonds, await getWalletConfig());
      }
    }

    await createAuditLog(adminId, 'family_task_reward', { familyId, taskCoins, taskDiamonds, description });
    res.status(200).json({ success: true, message: 'Family task reward added', data: familyWallet });
  } catch (error) {
    console.error('Add Family Task Reward Error:', error);
    next(error);
  }
};

// ===================== AGENCY WALLET & COMMISSION =====================

exports.getAgencyWallet = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('agencyId role uid');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let agencyId = user.agencyId;
    let isOwner = false;

    if (user.role === 'agency_owner' || user.role === 'owner') {
      const agency = await Agency.findOne({ owner: req.user.userId });
      if (agency) {
        agencyId = agency._id;
        isOwner = true;
      }
    }

    if (!agencyId) {
      return res.status(404).json({ success: false, message: 'No agency found for this user' });
    }

    let agencyWallet = await AgencyWallet.findOne({ agencyId });
    if (!agencyWallet) {
      agencyWallet = await AgencyWallet.create({ agencyId });
    }

    const agency = await Agency.findById(agencyId).select('name totalHosts commissionRate');
    const hosts = await User.find({ agencyId, role: 'host' }).select('uid name avatar diamonds coins');

    const config = await getWalletConfig();
    const estimatedCommission = hosts.reduce((sum, host) => sum + (host.diamonds || 0) * (config.agencyCommissionRate || 0.1), 0);

    res.status(200).json({
      success: true,
      data: {
        agency: agency ? {
          name: agency.name,
          totalHosts: agency.totalHosts,
          commissionRate: agency.commissionRate
        } : null,
        wallet: {
          balance: agencyWallet.balance,
          pendingWithdrawal: agencyWallet.pendingWithdrawal,
          totalEarnings: agencyWallet.totalEarnings,
          totalWithdrawn: agencyWallet.totalWithdrawn,
          estimatedCommission: Math.floor(estimatedCommission)
        },
        hosts: hosts.map(h => ({
          uid: h.uid,
          name: h.name,
          avatar: h.avatar,
          diamonds: h.diamonds,
          coins: h.coins,
          estimatedAgencyEarning: Math.floor((h.diamonds || 0) * (agency?.commissionRate || 0.1))
        })),
        isOwner
      }
    });
  } catch (error) {
    console.error('Get Agency Wallet Error:', error);
    next(error);
  }
};

exports.creditAgencyCommission = async (req, res, next) => {
  try {
    const { agencyId, hostId, diamondsEarned, commissionRate } = req.body;
    const adminId = req.user.userId;

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const rate = commissionRate || agency.commissionRate || 0.1;
    const commission = Math.floor(diamondsEarned * rate);

    let agencyWallet = await AgencyWallet.findOne({ agencyId });
    if (!agencyWallet) {
      agencyWallet = await AgencyWallet.create({ agencyId });
    }

    agencyWallet.balance += commission;
    agencyWallet.totalEarnings += commission;
    await agencyWallet.save();

    if (hostId) {
      const host = await User.findById(hostId);
      if (host) {
        const hostEarning = diamondsEarned - commission;
        await User.findByIdAndUpdate(hostId, { $inc: { diamonds: hostEarning } });
        await logTransaction(hostId, 'diamond', 'gift_received', hostEarning, `Host earnings after agency commission (${(rate * 100).toFixed(0)}%)`, {
          agencyId: agencyId.toString(),
          commissionRate: rate
        });

        await logTransaction(adminId, 'agency', 'agency_commission', commission, `Agency commission from host ${host.uid} - ${(rate * 100).toFixed(0)}% of ${diamondsEarned} diamonds`, {
          agencyId: agencyId.toString(),
          hostId: hostId.toString(),
          commissionRate: rate,
          diamondsEarned
        });

        await updateIncomeAnalytics(hostId, 'agency', 'agency_commission', commission, await getWalletConfig());
      }
    }

    await createAuditLog(adminId, 'agency_commission_credited', { agencyId, hostId, diamondsEarned, commission, commissionRate: rate });
    res.status(200).json({
      success: true,
      message: `Commission of ${commission} credited to agency wallet`,
      data: { agencyWallet, commission, commissionRate: rate }
    });
  } catch (error) {
    console.error('Credit Agency Commission Error:', error);
    next(error);
  }
};

exports.requestAgencyWithdrawal = async (req, res, next) => {
  try {
    const { amount, bankAccount, ifsc, accountName } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    const user = await User.findById(userId).select('agencyId role uid name');
    if (!user || (user.role !== 'agency_owner' && user.role !== 'owner')) {
      return res.status(403).json({ success: false, message: 'Only agency owners can withdraw' });
    }

    const agency = await Agency.findOne({ owner: userId });
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    let agencyWallet = await AgencyWallet.findOne({ agencyId: agency._id });
    if (!agencyWallet) {
      return res.status(400).json({ success: false, message: 'Agency wallet not found' });
    }

    if (agencyWallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient agency balance' });
    }

    agencyWallet.balance -= amount;
    agencyWallet.pendingWithdrawal += amount;
    await agencyWallet.save();

    const withdrawal = await Withdrawal.create({
      userId,
      uid: user.uid,
      diamondsRequested: amount,
      amountINR: Math.floor(amount / 100),
      bankAccount: bankAccount || user.kyc?.bankAccount,
      ifsc: ifsc || user.kyc?.ifsc,
      accountName: accountName || user.name,
      status: 'PENDING',
      currentStage: 'SELLER_REVIEW',
      workflow: [{
        stage: 'USER_REQUEST',
        actorId: userId,
        actorUid: user.uid,
        action: 'PENDING',
        note: 'Agency withdrawal request'
      }]
    });

    await logTransaction(userId, 'agency', 'agency_withdrawal', -amount, `Agency withdrawal request: ${amount}`, {
      agencyId: agency._id.toString(),
      withdrawalId: withdrawal._id.toString()
    });

    res.status(201).json({
      success: true,
      message: 'Agency withdrawal request submitted',
      data: { withdrawalId: withdrawal._id, amount, status: withdrawal.status }
    });
  } catch (error) {
    console.error('Request Agency Withdrawal Error:', error);
    next(error);
  }
};

// ===================== SEND GIFT =====================

exports.sendGift = async (req, res, next) => {
  try {
    const { recipientId, giftId, quantity = 1, giftName, costPerGift = 10 } = req.body;
    const senderId = req.user.userId;
    const totalCost = costPerGift * quantity;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient is required' });
    }

    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ success: false, message: 'Sender not found' });
    }

    if ((sender.coins || 0) < totalCost) {
      return res.status(400).json({ success: false, message: 'Insufficient coins' });
    }

    const senderBalanceAfter = sender.coins - totalCost;
    if (senderBalanceAfter < 0) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const config = await getWalletConfig();
    const taxPct = config.taxPercentage || 0;
    const taxAmount = Math.floor(totalCost * taxPct / 100);
    const recipientCredit = Math.floor((totalCost - taxAmount) * 0.7);
    const diamondCredit = Math.floor(recipientCredit * 0.1);

    await User.findByIdAndUpdate(senderId, { $inc: { coins: -totalCost, totalGiftsSent: quantity } });
    await User.findByIdAndUpdate(recipientId, { $inc: { coins: recipientCredit, diamonds: diamondCredit, totalGiftsReceived: quantity } });

    const coinBefore = sender.coins;
    await logTransaction(senderId, 'coin', 'gift_sent', -totalCost, `Sent gift${giftName ? ': ' + giftName : ''} x${quantity}`, {
      balanceBefore: coinBefore,
      balanceAfter: coinBefore - totalCost,
      recipientId, giftId, giftName, quantity, taxAmount
    });

    const recipient = await User.findById(recipientId);
    await logTransaction(recipientId, 'coin', 'gift_received', recipientCredit, `Received gift${giftName ? ': ' + giftName : ''} x${quantity}`, {
      balanceBefore: (recipient.coins || 0) - recipientCredit,
      balanceAfter: recipient.coins || 0,
      senderId, giftId, giftName, quantity
    });

    if (diamondCredit > 0) {
      await logTransaction(recipientId, 'diamond', 'gift_received', diamondCredit, `Diamonds from gift${giftName ? ': ' + giftName : ''} x${quantity}`, {
        senderId, giftId, giftName, quantity
      });
    }

    if (taxAmount > 0) {
      await logTransaction(senderId, 'coin', 'tax_deducted', -taxAmount, `Tax deducted on gift (${taxPct}%)`, {
        giftId, giftName, quantity, taxPercentage: taxPct
      });
    }

    await updateIncomeAnalytics(senderId, 'coin', 'gift_sent', -totalCost, config);
    await updateIncomeAnalytics(recipientId, 'coin', 'gift_received', recipientCredit, config);
    if (diamondCredit > 0) {
      await updateIncomeAnalytics(recipientId, 'diamond', 'gift_received', diamondCredit, config);
    }

    const updatedSender = await User.findById(senderId);
    res.status(200).json({
      success: true,
      message: 'Gift sent successfully',
      data: { coinsRemaining: updatedSender.coins, recipientId, quantity, taxAmount, diamondCredit }
    });
  } catch (error) {
    console.error('Send Gift Error:', error);
    next(error);
  }
};

// ===================== DIAMOND EXCHANGE =====================

exports.exchangeDiamondsToCoins = async (req, res, next) => {
  try {
    const { diamondsToExchange } = req.body;
    const userId = req.user.userId;

    if (!diamondsToExchange || diamondsToExchange <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid diamond amount' });
    }

    const config = await getWalletConfig();
    const requiredDiamonds = Math.ceil(diamondsToExchange);
    const coinsToReceive = Math.floor(diamondsToExchange / config.exchangeRate);

    if (coinsToReceive < 1) {
      return res.status(400).json({ success: false, message: `Minimum ${config.exchangeRate} diamonds required for exchange` });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if ((user.diamonds || 0) < requiredDiamonds) {
      return res.status(400).json({ success: false, message: 'Insufficient diamonds' });
    }

    const diamondBefore = user.diamonds;
    const coinBefore = user.coins;

    await User.findByIdAndUpdate(userId, {
      $inc: { diamonds: -requiredDiamonds, coins: coinsToReceive }
    });

    await logTransaction(userId, 'diamond', 'exchange_out', -requiredDiamonds, `Exchanged ${requiredDiamonds} diamonds → ${coinsToReceive} coins`, {
      balanceBefore: diamondBefore,
      balanceAfter: diamondBefore - requiredDiamonds,
      exchangeRate: config.exchangeRate
    });

    await logTransaction(userId, 'coin', 'exchange_in', coinsToReceive, `Received ${coinsToReceive} coins from diamond exchange`, {
      balanceBefore: coinBefore,
      balanceAfter: coinBefore + coinsToReceive,
      diamondsUsed: requiredDiamonds
    });

    await updateIncomeAnalytics(userId, 'diamond', 'exchange_out', -requiredDiamonds, config);
    await updateIncomeAnalytics(userId, 'coin', 'exchange_in', coinsToReceive, config);
    await createAuditLog(userId, 'diamond_exchange', { diamondsExchanged: requiredDiamonds, coinsReceived: coinsToReceive });

    const updatedUser = await User.findById(userId);
    res.status(200).json({
      success: true,
      message: 'Exchange successful',
      data: { diamondsRemaining: updatedUser.diamonds, coinsReceived, diamondsExchanged: requiredDiamonds }
    });
  } catch (error) {
    console.error('Exchange Error:', error);
    next(error);
  }
};

// ===================== WITHDRAWAL =====================

exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, diamonds } = req.body;
    const userId = req.user.userId;

    if ((!amount && !diamonds) || (amount !== undefined && amount <= 0) || (diamonds !== undefined && diamonds <= 0)) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    if (amount && diamonds) {
      return res.status(400).json({ success: false, message: 'Specify either amount or diamonds, not both' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'Account is banned. Withdrawals not allowed.' });
    }

    if (user.accountStatus === 'locked' || user.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: `Account is ${user.accountStatus}. Withdrawals not allowed.` });
    }

    const config = await getWalletConfig();
    const minWithdrawal = config.minWithdrawal || 500;
    const taxPct = config.taxPercentage || 0;

    let diamondsRequested = 0;
    let amountINR = 0;

    if (diamonds) {
      diamondsRequested = Math.floor(diamonds);
      if (diamondsRequested < minWithdrawal) {
        return res.status(400).json({ success: false, message: `Minimum ${minWithdrawal} diamonds required for withdrawal` });
      }
      if ((user.diamonds || 0) < diamondsRequested) {
        return res.status(400).json({ success: false, message: 'Insufficient diamonds' });
      }
      amountINR = Math.floor(diamondsRequested / config.exchangeRate);
    } else {
      amountINR = Math.floor(amount);
      if (amountINR < minWithdrawal) {
        return res.status(400).json({ success: false, message: `Minimum withdrawal is ₹${minWithdrawal}` });
      }
      const diamondsNeeded = amountINR * config.exchangeRate;
      if ((user.diamonds || 0) < diamondsNeeded) {
        return res.status(400).json({ success: false, message: 'Insufficient balance for this amount' });
      }
      diamondsRequested = diamondsNeeded;
    }

    const taxAmount = Math.floor(diamondsRequested * taxPct / 100);
    const diamondsAfterTax = diamondsRequested - taxAmount;

    const withdrawal = await Withdrawal.create({
      userId,
      uid: user.uid,
      diamondsRequested: diamondsAfterTax,
      coinsEquivalent: Math.floor(diamondsAfterTax / config.exchangeRate),
      amountINR: Math.floor(diamondsAfterTax / config.exchangeRate),
      bankAccount: req.body.bankAccount || user.kyc?.bankAccount,
      ifsc: req.body.ifsc || user.kyc?.ifsc,
      accountName: req.body.accountName || user.name,
      panNumber: req.body.panNumber || user.kyc?.pan,
      status: 'PENDING',
      currentStage: 'SELLER_REVIEW',
      kycVerified: user.kyc?.status === 'verified',
      workflow: [{
        stage: 'USER_REQUEST',
        actorId: userId,
        actorUid: user.uid,
        action: 'PENDING',
        note: 'Withdrawal request submitted by user'
      }],
      ipAddress: req.ip || req.connection.remoteAddress
    });

    await logTransaction(userId, 'diamond', 'withdrawal', -diamondsAfterTax, `Withdrawal request: ${diamondsAfterTax} diamonds (tax: ${taxAmount})`, {
      withdrawalId: withdrawal._id.toString(),
      taxAmount,
      taxPercentage: taxPct,
      amountInr: amountINR
    });

    if (taxAmount > 0) {
      await logTransaction(userId, 'diamond', 'tax_deducted', -taxAmount, `Tax deducted on withdrawal (${taxPct}%): ${taxAmount} diamonds`, {
        withdrawalId: withdrawal._id.toString(),
        taxPercentage: taxPct
      });
    }

    await updateIncomeAnalytics(userId, 'diamond', 'withdrawal', -diamondsAfterTax, config);
    await createAuditLog(userId, 'withdrawal_requested', { withdrawalId: withdrawal._id, diamondsRequested: diamondsAfterTax, amountINR, taxAmount });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        withdrawalId: withdrawal._id,
        status: withdrawal.status,
        diamondsRequested: diamondsAfterTax,
        amountINR,
        taxAmount,
        estimatedCoins: withdrawal.coinsEquivalent
      }
    });
  } catch (error) {
    console.error('Withdrawal Request Error:', error);
    next(error);
  }
};

exports.getWithdrawalStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const withdrawals = await Withdrawal.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json({ success: true, data: withdrawals });
  } catch (error) {
    console.error('Get Withdrawal Status Error:', error);
    next(error);
  }
};

exports.getAllWithdrawals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status;
    const userId = req.query.userId;

    const query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;

    const withdrawals = await Withdrawal.find(query)
      .populate('userId', 'uid name phone avatar coins diamonds')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Withdrawal.countDocuments(query);

    res.status(200).json({
      success: true,
      data: withdrawals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get All Withdrawals Error:', error);
    next(error);
  }
};

exports.getWithdrawalDetails = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id)
      .populate('userId', 'uid name phone avatar coins diamonds email')
      .lean();

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    res.status(200).json({ success: true, data: withdrawal });
  } catch (error) {
    console.error('Get Withdrawal Details Error:', error);
    next(error);
  }
};

exports.approveWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Cannot approve: status is ${withdrawal.status}` });
    }

    const approverId = req.user.userId;
    const approver = await User.findById(approverId).select('uid name role');
    const config = await getWalletConfig();
    const authorizedRoles = config.authorizedRoles || DEFAULT_CONFIG.authorizedRoles;

    if (!authorizedRoles.includes(approver.role) && approver.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Not authorized to approve withdrawals' });
    }

    const nextStage = {
      'SELLER_REVIEW': 'MERCHANT_REVIEW',
      'MERCHANT_REVIEW': 'OWNER_FINANCE',
      'OWNER_FINANCE': 'PROCESSING',
      'PROCESSING': 'PAID'
    };

    const user = await User.findById(withdrawal.userId);
    if ((user.diamonds || 0) < withdrawal.diamondsRequested) {
      return res.status(400).json({ success: false, message: 'User no longer has sufficient balance' });
    }

    withdrawal.workflow.push({
      stage: withdrawal.currentStage,
      actorId: approverId,
      actorUid: approver.uid,
      action: 'APPROVED',
      note: `Approved by ${approver.name} (${approver.role})`
    });

    const newStage = nextStage[withdrawal.currentStage];
    if (newStage === 'PAID') {
      withdrawal.status = 'APPROVED';
      withdrawal.currentStage = 'PROCESSING';
      await User.findByIdAndUpdate(withdrawal.userId, {
        $inc: { diamonds: -withdrawal.diamondsRequested }
      });
      await logTransaction(withdrawal.userId, 'diamond', 'withdrawal', -withdrawal.diamondsRequested, `Withdrawal approved: ${withdrawal.diamondsRequested} diamonds`, {
        withdrawalId: withdrawal._id,
        approvedBy: approverId
      });
    } else {
      withdrawal.currentStage = newStage;
    }

    withdrawal.paidAt = withdrawal.status === 'APPROVED' ? new Date() : null;
    await withdrawal.save();

    if (withdrawal.status === 'APPROVED') {
      const io = req.app.get('io');
      if (io) {
        io.to(withdrawal.userId.toString()).emit('withdrawal_approved', {
          withdrawalId: withdrawal._id,
          diamondsRequested: withdrawal.diamondsRequested,
          amountINR: withdrawal.amountINR
        });
      }
    }

    await createAuditLog(approverId, 'withdrawal_approved', {
      withdrawalId: withdrawal._id,
      userId: withdrawal.userId,
      newStage
    });

    res.status(200).json({ success: true, message: 'Withdrawal approved', data: withdrawal });
  } catch (error) {
    console.error('Approve Withdrawal Error:', error);
    next(error);
  }
};

exports.rejectWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Cannot reject: status is ${withdrawal.status}` });
    }

    const { note } = req.body;
    const rejectorId = req.user.userId;
    const rejector = await User.findById(rejectorId).select('uid name role');

    withdrawal.status = 'REJECTED';
    withdrawal.currentStage = 'REJECTED';
    withdrawal.workflow.push({
      stage: withdrawal.currentStage,
      actorId: rejectorId,
      actorUid: rejector.uid,
      action: 'REJECTED',
      note: note || 'Withdrawal request rejected'
    });
    await withdrawal.save();

    await createAuditLog(rejectorId, 'withdrawal_rejected', { withdrawalId: withdrawal._id, userId: withdrawal.userId, note });

    const io = req.app.get('io');
    if (io) {
      io.to(withdrawal.userId.toString()).emit('withdrawal_rejected', {
        withdrawalId: withdrawal._id,
        diamondsRequested: withdrawal.diamondsRequested,
        reason: note || 'Request rejected'
      });
    }

    res.status(200).json({ success: true, message: 'Withdrawal rejected', data: withdrawal });
  } catch (error) {
    console.error('Reject Withdrawal Error:', error);
    next(error);
  }
};

exports.processWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'APPROVED' || withdrawal.currentStage !== 'PROCESSING') {
      return res.status(400).json({ success: false, message: 'Withdrawal not ready for processing' });
    }

    const { paymentReference } = req.body;
    const processorId = req.user.userId;
    const processor = await User.findById(processorId).select('uid name role');

    if (!paymentReference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    withdrawal.status = 'PAID';
    withdrawal.currentStage = 'PAID';
    withdrawal.paymentReference = paymentReference;
    withdrawal.paidBy = processorId;
    withdrawal.paidAt = new Date();
    withdrawal.workflow.push({
      stage: 'PROCESSING',
      actorId: processorId,
      actorUid: processor.uid,
      action: 'PAID',
      note: `Payment processed: ${paymentReference}`
    });
    await withdrawal.save();

    await createAuditLog(processorId, 'withdrawal_paid', { withdrawalId: withdrawal._id, userId: withdrawal.userId, paymentReference });

    const io = req.app.get('io');
    if (io) {
      io.to(withdrawal.userId.toString()).emit('withdrawal_paid', {
        withdrawalId: withdrawal._id,
        amountINR: withdrawal.amountINR,
        paymentReference
      });
    }

    res.status(200).json({ success: true, message: 'Withdrawal marked as paid', data: withdrawal });
  } catch (error) {
    console.error('Process Withdrawal Error:', error);
    next(error);
  }
};

// ===================== INCOME ANALYTICS =====================

exports.getIncomeAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const range = req.query.range || 'monthly';
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    let analytics;
    if (range === 'daily') {
      analytics = await IncomeAnalytics.find({ userId, year, month })
        .sort({ day: 1 })
        .lean();
    } else if (range === 'monthly') {
      analytics = await IncomeAnalytics.aggregate([
        { $match: { userId: userId._id || userId, year } },
        {
          $group: {
            _id: '$month',
            totalIncome: { $sum: '$summary.totalIncome' },
            totalExpense: { $sum: '$summary.totalExpense' },
            netChange: { $sum: '$summary.netChange' },
            taxDeducted: { $sum: '$summary.taxDeducted' },
            coinRecharge: { $sum: '$coinWallet.recharge' },
            diamondGiftReceived: { $sum: '$diamondWallet.giftReceived' },
            familyTaskEarned: { $sum: '$familyWallet.taskEarned' },
            agencyCommission: { $sum: '$agencyWallet.commissionEarned' },
            dayCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } else {
      analytics = await IncomeAnalytics.aggregate([
        { $match: { userId: userId._id || userId } },
        {
          $group: {
            _id: '$year',
            totalIncome: { $sum: '$summary.totalIncome' },
            totalExpense: { $sum: '$summary.totalExpense' },
            netChange: { $sum: '$summary.netChange' },
            taxDeducted: { $sum: '$summary.taxDeducted' },
            dayCount: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } }
      ]);
    }

    const totals = await IncomeAnalytics.aggregate([
      { $match: { userId: userId._id || userId } },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: '$summary.totalIncome' },
          totalExpense: { $sum: '$summary.totalExpense' },
          netChange: { $sum: '$summary.netChange' },
          taxDeducted: { $sum: '$summary.taxDeducted' }
        }
      }
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayData = await IncomeAnalytics.findOne({ userId, date: today });

    res.status(200).json({
      success: true,
      data: {
        analytics,
        totals: totals[0] || { totalIncome: 0, totalExpense: 0, netChange: 0, taxDeducted: 0 },
        today: todayData ? {
          income: todayData.summary.totalIncome,
          expense: todayData.summary.totalExpense,
          netChange: todayData.summary.netChange,
          taxDeducted: todayData.summary.taxDeducted
        } : { income: 0, expense: 0, netChange: 0, taxDeducted: 0 },
        range,
        year,
        month
      }
    });
  } catch (error) {
    console.error('Get Income Analytics Error:', error);
    next(error);
  }
};

// ===================== ADMIN: FREEZE/UNFREEZE WALLET (TAX & SAFETY) =====================

exports.freezeUserWallet = async (req, res, next) => {
  try {
    const { userId, walletType, reason } = req.body;

    if (!userId || !walletType) {
      return res.status(400).json({ success: false, message: 'User ID and wallet type required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const adminId = req.user.userId;
    let result = {};

    if (walletType === 'coin' || walletType === 'all') {
      await User.findByIdAndUpdate(userId, { isBlocked: true, banReason: reason || 'Wallet frozen by admin', bannedBy: adminId });
      await logTransaction(userId, 'coin', 'freeze_adjustment', 0, `Coin wallet frozen: ${reason}`, { frozenBy: adminId });
    }

    if (walletType === 'diamond' || walletType === 'all') {
      await logTransaction(userId, 'diamond', 'freeze_adjustment', 0, `Diamond wallet frozen: ${reason}`, { frozenBy: adminId });
    }

    if (walletType === 'family') {
      const familyWallet = await FamilyWallet.findOneAndUpdate(
        { familyId: user.familyId },
        { isFrozen: true, frozenAt: new Date(), frozenBy: adminId, freezeReason: reason || 'Frozen by admin' },
        { new: true }
      );
      if (familyWallet) result.familyWallet = familyWallet;
    }

    if (walletType === 'agency') {
      const agencyWallet = await AgencyWallet.findOneAndUpdate(
        { agencyId: user.agencyId },
        { $set: {} },
        { new: true }
      );
      await logTransaction(userId, 'agency', 'freeze_adjustment', 0, `Agency wallet frozen: ${reason}`, { frozenBy: adminId });
    }

    await createAuditLog(adminId, 'wallet_frozen', { targetUserId: userId, walletType, reason });

    res.status(200).json({ success: true, message: `Wallet ${walletType} frozen`, data: result });
  } catch (error) {
    console.error('Freeze Wallet Error:', error);
    next(error);
  }
};

exports.unfreezeUserWallet = async (req, res, next) => {
  try {
    const { userId, walletType, reason } = req.body;

    if (!userId || !walletType) {
      return res.status(400).json({ success: false, message: 'User ID and wallet type required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const adminId = req.user.userId;

    if (walletType === 'coin' || walletType === 'all') {
      await User.findByIdAndUpdate(userId, { isBlocked: false, banReason: null, bannedBy: null });
      await logTransaction(userId, 'coin', 'unfreeze_adjustment', 0, `Coin wallet unfrozen: ${reason}`, { unfrozenBy: adminId });
    }

    if (walletType === 'family') {
      await FamilyWallet.findOneAndUpdate(
        { familyId: user.familyId },
        { isFrozen: false, frozenAt: null, frozenBy: null, freezeReason: null }
      );
    }

    if (walletType === 'agency') {
      await logTransaction(userId, 'agency', 'unfreeze_adjustment', 0, `Agency wallet unfrozen: ${reason}`, { unfrozenBy: adminId });
    }

    await createAuditLog(adminId, 'wallet_unfrozen', { targetUserId: userId, walletType, reason });

    res.status(200).json({ success: true, message: `Wallet ${walletType} unfrozen` });
  } catch (error) {
    console.error('Unfreeze Wallet Error:', error);
    next(error);
  }
};

exports.adjustUserWallet = async (req, res, next) => {
  try {
    const { userId, coins, diamonds, reason, walletType } = req.body;
    const adminId = req.user.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const update = {};
    if (coins !== undefined) {
      if (walletType === 'diamond' || !walletType) update.diamonds = (user.diamonds || 0) + Number(coins);
      else update.coins = (user.coins || 0) + Number(coins);
    }
    if (diamonds !== undefined) update.diamonds = (user.diamonds || 0) + Number(diamonds);

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'No changes specified' });
    }

    await User.findByIdAndUpdate(userId, update);
    const updatedUser = await User.findById(userId);

    const modifiedFields = Object.keys(update).map(key => ({
      key,
      oldValue: key === 'coins' ? user.coins : user.diamonds,
      newValue: updatedUser[key]
    }));

    const adjustedCoinAmount = coins ? Number(coins) : 0;
    const adjustedDiamondAmount = diamonds ? Number(diamonds) : 0;
    if (adjustedCoinAmount !== 0) {
      const targetWallet = walletType === 'diamond' ? 'diamond' : 'coin';
      await logTransaction(userId, targetWallet, 'admin_adjust', adjustedCoinAmount, `Admin adjustment: ${reason}`, { adminId });
    }
    if (adjustedDiamondAmount !== 0) {
      await logTransaction(userId, 'diamond', 'admin_adjust', adjustedDiamondAmount, `Admin adjustment: ${reason}`, { adminId });
    }

    const config = await getWalletConfig();
    if (adjustedCoinAmount !== 0) {
      await updateIncomeAnalytics(userId, 'coin', 'admin_adjust', adjustedCoinAmount, config);
    }
    if (adjustedDiamondAmount !== 0) {
      await updateIncomeAnalytics(userId, 'diamond', 'admin_adjust', adjustedDiamondAmount, config);
    }

    await createAuditLog(adminId, 'wallet_adjusted', { targetUserId: userId, changes: modifiedFields, reason });

    res.status(200).json({ success: true, message: 'Wallet adjusted', data: updatedUser });
  } catch (error) {
    console.error('Adjust Wallet Error:', error);
    next(error);
  }
};

exports.getWalletStats = async (req, res, next) => {
  try {
    const totalCoins = await User.aggregate([{ $group: { _id: null, total: { $sum: '$coins' } } }]);
    const totalDiamonds = await User.aggregate([{ $group: { _id: null, total: { $sum: '$diamonds' } } }]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecharges = await WalletTransaction.aggregate([
      { $match: { type: 'recharge', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'PENDING' });

    const familyWalletTotal = await FamilyWallet.aggregate([
      { $group: { _id: null, totalCoins: { $sum: '$totalCoins' }, totalDiamonds: { $sum: '$totalDiamonds' } } }
    ]);

    const agencyWalletTotal = await AgencyWallet.aggregate([
      { $group: { _id: null, totalBalance: { $sum: '$balance' }, totalEarnings: { $sum: '$totalEarnings' } } }
    ]);

    const totalCommission = await WalletTransaction.aggregate([
      { $match: { type: 'agency_commission' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalFamilyEarnings = await WalletTransaction.aggregate([
      { $match: { type: 'family_task_reward' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalCoins: totalCoins[0]?.total || 0,
        totalDiamonds: totalDiamonds[0]?.total || 0,
        todayRecharges: todayRecharges[0]?.total || 0,
        pendingWithdrawals,
        familyWallet: {
          totalCoins: familyWalletTotal[0]?.totalCoins || 0,
          totalDiamonds: familyWalletTotal[0]?.totalDiamonds || 0
        },
        agencyWallet: {
          totalBalance: agencyWalletTotal[0]?.totalBalance || 0,
          totalEarnings: agencyWalletTotal[0]?.totalEarnings || 0,
          totalCommission: totalCommission[0]?.total || 0
        },
        totalFamilyEarnings: totalFamilyEarnings[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get Wallet Stats Error:', error);
    next(error);
  }
};

exports.getWalletConfig = async (req, res, next) => {
  try {
    const config = await getWalletConfig();
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error('Get Wallet Config Error:', error);
    next(error);
  }
};

exports.updateWalletConfig = async (req, res, next) => {
  try {
    const config = await getWalletConfig();
    const updatedConfig = { ...config, ...req.body };
    await WalletConfig.findOneAndUpdate({ configKey: 'wallet_settings' }, { configValue: updatedConfig }, { new: true });
    await createAuditLog(req.user.userId, 'wallet_config_updated', { config: updatedConfig });
    res.status(200).json({ success: true, message: 'Configuration updated', data: updatedConfig });
  } catch (error) {
    console.error('Update Wallet Config Error:', error);
    next(error);
  }
};

exports.getAllTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const userId = req.query.userId;
    const walletType = req.query.walletType;
    const type = req.query.type;

    const query = {};
    if (userId) query.userId = userId;
    if (walletType) query.walletType = walletType;
    if (type) query.type = type;

    const transactions = await WalletTransaction.find(query)
      .populate('userId', 'uid name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await WalletTransaction.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get All Transactions Error:', error);
    next(error);
  }
};

// ===================== ADMIN: TAX RECORDS =====================

exports.getTaxRecords = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const taxTransactions = await WalletTransaction.find({ type: 'tax_deducted' })
      .populate('userId', 'uid name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await WalletTransaction.countDocuments({ type: 'tax_deducted' });

    const totalTax = await WalletTransaction.aggregate([
      { $match: { type: 'tax_deducted' } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        transactions: taxTransactions,
        totalTaxCollected: totalTax[0]?.total || 0,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Get Tax Records Error:', error);
    next(error);
  }
};

// ===================== FAMILY WALLET TRANSACTIONS =====================

exports.getFamilyWalletTransactions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('familyId');
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'No family found' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await WalletTransaction.find({
      walletType: 'family',
      familyId: user.familyId
    })
      .populate('userId', 'uid name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await WalletTransaction.countDocuments({
      walletType: 'family',
      familyId: user.familyId
    });

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Get Family Wallet Transactions Error:', error);
    next(error);
  }
};

// ===================== AGENCY WALLET TRANSACTIONS =====================

exports.getAgencyWalletTransactions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('agencyId role');
    if (!user || !user.agencyId) {
      return res.status(404).json({ success: false, message: 'No agency found' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await WalletTransaction.find({
      walletType: 'agency',
      $or: [
        { agencyId: user.agencyId },
        { userId: req.user.userId }
      ]
    })
      .populate('userId', 'uid name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await WalletTransaction.countDocuments({
      walletType: 'agency',
      $or: [
        { agencyId: user.agencyId },
        { userId: req.user.userId }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Get Agency Wallet Transactions Error:', error);
    next(error);
  }
};

// ===================== AGENCY MASTER WALLET - HOST DASHBOARD =====================

exports.getHostAgencyDashboard = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('agencyId role uid name coins diamonds');
    if (!user || !user.agencyId) {
      return res.status(404).json({ success: false, message: 'No agency found' });
    }

    const agency = await Agency.findById(user.agencyId).select('name commissionRate owner hosts');
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthlyStats = await AgencyMonthlyStats.findOne({
      agencyId: user.agencyId,
      year: today.getFullYear(),
      month: today.getMonth() + 1
    });

    const hostStats = monthlyStats?.hostBreakdown?.find(h => h.hostId.toString() === userId.toString());
    const targetCoins = hostStats?.targetCoins || 0;
    const earningsDiamonds = hostStats?.earningsDiamonds || 0;
    const earningsCoins = hostStats?.earningsCoins || 0;
    const commissionToOwner = hostStats?.commissionToOwner || 0;
    const giftsReceived = hostStats?.giftsReceived || 0;
    const targetReward = Math.floor(earningsDiamonds * 0.1);

    const agencyWallet = await AgencyWallet.findOne({ agencyId: user.agencyId });

    res.status(200).json({
      success: true,
      data: {
        agency: {
          id: agency._id,
          name: agency.name,
          commissionRate: agency.commissionRate || 0.1,
          totalHosts: agency.hosts?.length || 0
        },
        host: {
          uid: user.uid,
          name: user.name,
          coins: user.coins || 0,
          diamonds: user.diamonds || 0
        },
        currentMonth: {
          targetCoins,
          earningsDiamonds,
          earningsCoins,
          commissionToOwner,
          giftsReceived,
          targetReward,
          agencyTotalEarnings: monthlyStats?.totalHostEarningsDiamonds || 0,
          agencyTotalCommission: monthlyStats?.ownerCommissionDiamonds || 0
        },
        wallet: {
          agencyBalance: agencyWallet?.balance || 0,
          agencyPendingWithdrawal: agencyWallet?.pendingWithdrawal || 0,
          agencyTotalEarnings: agencyWallet?.totalEarnings || 0
        }
      }
    });
  } catch (error) {
    console.error('Get Host Agency Dashboard Error:', error);
    next(error);
  }
};

// ===================== AGENCY MASTER WALLET - OWNER DASHBOARD =====================

exports.getOwnerAgencyDashboard = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const agency = await Agency.findOne({ owner: userId }).populate('hosts', 'uid name avatar coins diamonds');
    if (!agency) {
      return res.status(404).json({ success: false, message: 'No agency found for owner' });
    }

    const agencyId = agency._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const twoMonthsAgo = lastMonth === 1 ? 12 : lastMonth - 1;
    const twoMonthsAgoYear = lastMonth === 1 ? lastMonthYear - 1 : lastMonthYear;

    const currentMonthStats = await AgencyMonthlyStats.findOne({
      agencyId,
      year: currentYear,
      month: currentMonth
    });

    const lastMonthStats = await AgencyMonthlyStats.findOne({
      agencyId,
      year: lastMonthYear,
      month: lastMonth
    });

    const twoMonthsAgoStats = await AgencyMonthlyStats.findOne({
      agencyId,
      year: twoMonthsAgoYear,
      month: twoMonthsAgo
    });

    const agencyWallet = await AgencyWallet.findOne({ agencyId });

    const hostsList = agency.hosts.map(host => {
      if (typeof host === 'object' && host !== null) {
        const hostMonthlyStats = currentMonthStats?.hostBreakdown?.find(h => h.hostId.toString() === host._id.toString());
        const earnings = hostMonthlyStats?.earningsDiamonds || 0;
        const commission = hostMonthlyStats?.commissionToOwner || 0;
        const target = hostMonthlyStats?.targetCoins || 0;
        return {
          _id: host._id,
          uid: host.uid,
          name: host.name,
          avatar: host.avatar,
          currentMonthEarnings: earnings,
          currentMonthCommission: commission,
          currentMonthTargetCoins: target,
          totalCoins: host.coins || 0,
          totalDiamonds: host.diamonds || 0
        };
      }
      return host;
    });

    const formatMonthStats = (stats) => {
      if (!stats) {
        return {
          totalHostTargetCoins: 0,
          totalHostEarningsDiamonds: 0,
          totalHostEarningsCoins: 0,
          ownerCommissionDiamonds: 0,
          ownerCommissionCoins: 0,
          activeHostsCount: 0,
          totalGiftsReceived: 0,
          totalWithdrawals: 0,
          hostBreakdown: []
        };
      }
      return {
        totalHostTargetCoins: stats.totalHostTargetCoins || 0,
        totalHostEarningsDiamonds: stats.totalHostEarningsDiamonds || 0,
        totalHostEarningsCoins: stats.totalHostEarningsCoins || 0,
        ownerCommissionDiamonds: stats.ownerCommissionDiamonds || 0,
        ownerCommissionCoins: stats.ownerCommissionCoins || 0,
        activeHostsCount: stats.activeHostsCount || 0,
        totalGiftsReceived: stats.totalGiftsReceived || 0,
        totalWithdrawals: stats.totalWithdrawals || 0,
        hostBreakdown: stats.hostBreakdown || []
      };
    };

    res.status(200).json({
      success: true,
      data: {
        agency: {
          id: agencyId,
          name: agency.name,
          commissionRate: agency.commissionRate || 0.1,
          totalHosts: agency.hosts?.length || 0
        },
        hosts: hostsList,
        currentMonth: formatMonthStats(currentMonthStats),
        lastMonth: formatMonthStats(lastMonthStats),
        twoMonthsAgo: formatMonthStats(twoMonthsAgoStats),
        wallet: {
          balance: agencyWallet?.balance || 0,
          pendingWithdrawal: agencyWallet?.pendingWithdrawal || 0,
          totalEarnings: agencyWallet?.totalEarnings || 0,
          totalWithdrawn: agencyWallet?.totalWithdrawn || 0
        }
      }
    });
  } catch (error) {
    console.error('Get Owner Agency Dashboard Error:', error);
    next(error);
  }
};

// ===================== AGENCY MASTER WALLET - MONTHLY STATS HISTORY =====================

exports.getAgencyMonthlyHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const agency = await Agency.findOne({ owner: userId });
    if (!agency) {
      return res.status(404).json({ success: false, message: 'No agency found' });
    }

    const months = parseInt(req.query.months) || 6;
    const now = new Date();
    const stats = [];

    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;

      const monthlyStats = await AgencyMonthlyStats.findOne({
        agencyId: agency._id,
        year,
        month
      });

      stats.push({
        year,
        month,
        monthName: d.toLocaleString('default', { month: 'long' }),
        ...(monthlyStats ? {
          totalHostTargetCoins: monthlyStats.totalHostTargetCoins || 0,
          totalHostEarningsDiamonds: monthlyStats.totalHostEarningsDiamonds || 0,
          totalHostEarningsCoins: monthlyStats.totalHostEarningsCoins || 0,
          ownerCommissionDiamonds: monthlyStats.ownerCommissionDiamonds || 0,
          ownerCommissionCoins: monthlyStats.ownerCommissionCoins || 0,
          activeHostsCount: monthlyStats.activeHostsCount || 0,
          totalGiftsReceived: monthlyStats.totalGiftsReceived || 0,
          totalWithdrawals: monthlyStats.totalWithdrawals || 0,
          hostBreakdown: monthlyStats.hostBreakdown || []
        } : {
          totalHostTargetCoins: 0,
          totalHostEarningsDiamonds: 0,
          totalHostEarningsCoins: 0,
          ownerCommissionDiamonds: 0,
          ownerCommissionCoins: 0,
          activeHostsCount: 0,
          totalGiftsReceived: 0,
          totalWithdrawals: 0,
          hostBreakdown: []
        })
      });
    }

    res.status(200).json({
      success: true,
      data: {
        agencyId: agency._id,
        agencyName: agency.name,
        history: stats,
        monthsRequested: months
      }
    });
  } catch (error) {
    console.error('Get Agency Monthly History Error:', error);
    next(error);
  }
};

// ===================== AGENCY MASTER WALLET - UPDATE MONTHLY STATS =====================

exports.updateAgencyMonthlyStats = async (req, res, next) => {
  try {
    const { agencyId, hostId, diamondsEarned, coinsEarned, commissionAmount, giftsReceived, daysActive } = req.body;
    const adminId = req.user.userId;

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const host = await User.findById(hostId).select('uid name agencyId');
    if (!host || host.agencyId?.toString() !== agencyId.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid host for this agency' });
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    let monthlyStats = await AgencyMonthlyStats.findOne({
      agencyId,
      year,
      month
    });

    if (!monthlyStats) {
      monthlyStats = await AgencyMonthlyStats.create({
        agencyId,
        agencyName: agency.name,
        year,
        month,
        hostBreakdown: [],
        totalHostTargetCoins: 0,
        totalHostEarningsDiamonds: 0,
        totalHostEarningsCoins: 0,
        ownerCommissionDiamonds: 0,
        ownerCommissionCoins: 0,
        activeHostsCount: 0,
        totalGiftsReceived: 0,
        totalWithdrawals: 0
      });
    }

    const existingHostIndex = monthlyStats.hostBreakdown.findIndex(
      h => h.hostId.toString() === hostId.toString()
    );

    if (existingHostIndex >= 0) {
      monthlyStats.hostBreakdown[existingHostIndex].earningsDiamonds += diamondsEarned || 0;
      monthlyStats.hostBreakdown[existingHostIndex].earningsCoins += coinsEarned || 0;
      monthlyStats.hostBreakdown[existingHostIndex].commissionToOwner += commissionAmount || 0;
      monthlyStats.hostBreakdown[existingHostIndex].giftsReceived += giftsReceived || 0;
      monthlyStats.hostBreakdown[existingHostIndex].daysActive = Math.max(
        monthlyStats.hostBreakdown[existingHostIndex].daysActive,
        daysActive || monthlyStats.hostBreakdown[existingHostIndex].daysActive
      );
    } else {
      monthlyStats.hostBreakdown.push({
        hostId,
        hostUid: host.uid,
        hostName: host.name || 'Unknown',
        targetCoins: 0,
        earningsDiamonds: diamondsEarned || 0,
        earningsCoins: coinsEarned || 0,
        commissionToOwner: commissionAmount || 0,
        giftsReceived: giftsReceived || 0,
        daysActive: daysActive || 0
      });
    }

    monthlyStats.totalHostEarningsDiamonds += diamondsEarned || 0;
    monthlyStats.totalHostEarningsCoins += coinsEarned || 0;
    monthlyStats.ownerCommissionDiamonds += commissionAmount || 0;
    monthlyStats.totalGiftsReceived += giftsReceived || 0;

    const uniqueActiveHosts = monthlyStats.hostBreakdown.filter(h => (h.daysActive || 0) > 0).length;
    monthlyStats.activeHostsCount = uniqueActiveHosts;

    await monthlyStats.save();

    await createAuditLog(adminId, 'agency_monthly_stats_updated', {
      agencyId,
      hostId,
      diamondsEarned,
      commissionAmount,
      month,
      year
    });

    res.status(200).json({
      success: true,
      message: 'Monthly stats updated successfully',
      data: monthlyStats
    });
  } catch (error) {
    console.error('Update Agency Monthly Stats Error:', error);
    next(error);
  }
};
