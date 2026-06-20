const VipPlan = require('../models/VipPlan');
const VipUser = require('../models/VipUser');
const User = require('../models/User');

exports.getVipPlans = async (req, res) => {
  try {
    const plans = await VipPlan.find().sort({ level: 1 });
    res.status(200).json({ success: true, plans });
  } catch (error) {
    console.error('Fetch VIP Plans Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VIP plans' });
  }
};

exports.buyVip = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id || req.user.userId;

    const plan = await VipPlan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: 'VIP Plan not found' });

    const user = await User.findById(userId);
    if (user.coins < plan.price) {
      return res.status(400).json({ success: false, message: 'Insufficient coins to buy this VIP plan' });
    }

    // Deduct coins and update user profile
    user.coins -= plan.price;
    user.vipLevel = plan.level;
    await user.save();

    // Calculate expiration date
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + plan.durationDays);

    const vipRecord = await VipUser.findOneAndUpdate(
      { userId },
      { vipLevel: plan.level, expireDate, isActive: true, startDate: new Date() },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: 'VIP purchased successfully!', vip: vipRecord });
  } catch (error) {
    console.error('Buy VIP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to process VIP purchase' });
  }
};