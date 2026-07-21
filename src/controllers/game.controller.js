const User = require('../models/User');
const LuckyDrawReward = require('../models/LuckyDrawReward');

// Cost per spin
const SPIN_COST_COINS = 50;

/**
 * @desc    Get all active rewards for the Lucky Wheel UI
 * @route   GET /api/games/lucky-wheel/rewards
 */
exports.getLuckyWheelRewards = async (req, res) => {
  try {
    const rewards = await LuckyDrawReward.find({ isActive: true })
      .select('_id name type value image probability')
      .lean();
    return res.status(200).json({ success: true, data: rewards });
  } catch (error) {
    console.error('getLuckyWheelRewards Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * @desc    Execute a spin, deduct balance, calculate probability, and award user
 * @route   POST /api/games/lucky-wheel/spin
 */
exports.spinLuckyWheel = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    // 1. Check and deduct balance — ATOMIC
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: SPIN_COST_COINS } },
      { $inc: { coins: -SPIN_COST_COINS } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ success: false, message: `Not enough coins. Need ${SPIN_COST_COINS} coins to spin.` });
    }

    // 2. Fetch Rewards
    const rewards = await LuckyDrawReward.find({ isActive: true }).lean();
    if (rewards.length === 0) {
      return res.status(400).json({ success: false, message: 'Rewards pool is empty.' });
    }

    // 3. Mathematical Probability Algorithm
    const rand = Math.random();
    let cumulativeProb = 0;
    let selectedReward = rewards[rewards.length - 1]; // Fallback to last item

    for (const reward of rewards) {
      cumulativeProb += reward.probability;
      if (rand <= cumulativeProb) {
        selectedReward = reward;
        break;
      }
    }

    // 4. Grant the reward — ATOMIC
    if (selectedReward.type === 'coin') {
      await User.findByIdAndUpdate(userId, { $inc: { coins: selectedReward.value } });
    } else if (selectedReward.type === 'diamond') {
      await User.findByIdAndUpdate(userId, { $inc: { diamonds: selectedReward.value } });
    }

    // 5. Respond with result
    return res.status(200).json({
      success: true,
      message: `Congratulations! You won ${selectedReward.name}`,
      data: { reward: selectedReward, newBalance: user.coins }
    });
  } catch (error) {
    console.error('spinLuckyWheel Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};