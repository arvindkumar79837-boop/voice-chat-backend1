const User = require('../models/User');

// GET /api/system/referral
exports.getReferralInfo = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const user = await User.findById(userId).select('referralCode referralCount referralRewards');
    res.json({
      success: true,
      referralLink: `https://arvindparty.com/invite/${user?.referralCode || userId}`,
      referralCode: user?.referralCode || userId?.toString().slice(-6),
      totalReferrals: user?.referralCount || 0,
      totalRewards: user?.referralRewards || 0,
      pendingRewards: 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/system/referral/claim
exports.claimReward = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const reward = 100;
    await User.findByIdAndUpdate(userId, { $inc: { coins: reward } });
    res.json({ success: true, reward, message: 'Reward claimed!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};