const TreasuryLog = require('../models/TreasuryLog');

exports.generateCoins = async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid coin amount' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Audit reason is required' });
    }

    const generatedBy = req.userRole || 'OWNER.WEB';
    const log = new TreasuryLog({
      amount,
      reason,
      generatedBy
    });
    await log.save();
    
    return res.status(200).json({
      success: true,
      message: `${amount} coins generated successfully.`,
      data: { amount, reason, generatedBy, timestamp: log.createdAt }
    });
  } catch (error) {
    console.error('Coin Generation Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.deductCoins = async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid coin amount' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Audit reason is required' });
    }

    const generatedBy = req.userRole || 'OWNER.WEB';
    const log = new TreasuryLog({
      amount: -Math.abs(amount),
      reason: `DEDUCTION: ${reason}`,
      generatedBy
    });
    await log.save();
    
    return res.status(200).json({
      success: true,
      message: `${amount} coins deducted successfully.`,
      data: { amount: -Math.abs(amount), reason, generatedBy, timestamp: log.createdAt }
    });
  } catch (error) {
    console.error('Coin Deduction Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.sendReward = async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'User ID and valid amount are required' });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.coins = (user.coins || 0) + amount;
    await user.save();

    const generatedBy = req.userRole || 'OWNER.WEB';
    const log = new TreasuryLog({
      amount,
      reason: `REWARD to ${user.uid || userId}: ${reason || 'Admin reward'}`,
      generatedBy
    });
    await log.save();
    
    return res.status(200).json({
      success: true,
      message: `${amount} coins sent to user successfully.`,
      data: { userId, amount, reason, generatedBy, timestamp: log.createdAt }
    });
  } catch (error) {
    console.error('Send Reward Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getCoinOrders = async (req, res) => {
  try {
    const logs = await TreasuryLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('Get Coin Orders Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const logs = await TreasuryLog.find().sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('Fetch Logs Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};