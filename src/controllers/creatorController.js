const User = require('../models/User');
const Transaction = require('../models/Transaction');

// GET /api/creator/earnings
exports.getEarnings = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const user = await User.findById(userId).select('creatorInfo');
    const earnings = await Transaction.aggregate([
      { $match: { toUserId: userId, type: 'gift_sent' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      isCreator: user?.creatorInfo?.isCreator || false,
      creatorLevel: user?.creatorInfo?.level || 1,
      isVerified: user?.creatorInfo?.isVerified || false,
      totalEarnings: earnings[0]?.total || 0,
      monthlyEarnings: 0,
      totalFans: user?.creatorInfo?.totalFans || 0,
      recentPayments: []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/creator/analytics
exports.getAnalytics = async (req, res) => {
  try {
    res.json({ success: true, analytics: { views: 0, earnings: 0, fans: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/creator/withdraw
exports.withdrawEarnings = async (req, res) => {
  try {
    const { amount } = req.body;
    res.json({ success: true, message: 'Withdrawal request submitted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};