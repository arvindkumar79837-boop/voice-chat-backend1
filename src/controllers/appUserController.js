const User = require('../models/User');
const Agency = require('../models/Agency');
const Withdrawal = require('../models/Withdrawal');

exports.joinAgency = async (req, res) => {
  try {
    const { userId, agencyId } = req.body;

    if (!userId || !agencyId) return res.status(400).json({ success: false, message: 'User ID and Agency ID required' });

    const agency = await Agency.findById(agencyId);
    if (!agency) return res.status(404).json({ success: false, message: 'Invalid Agency ID' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.agencyId = agency._id;
    await user.save();

    agency.totalHosts = (agency.totalHosts || 0) + 1;
    await agency.save();

    return res.status(200).json({ success: true, message: 'Successfully joined the Agency' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.requestWithdrawal = async (req, res) => {
  try {
    const { userId, coins, paymentDetails } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.coins < coins) return res.status(400).json({ success: false, message: 'Insufficient coins balance' });

    // Conversion Logic: 1000 Coins = 1 USD (Example)
    const amountUSD = coins / 1000;

    // Instant deduction to prevent double-spending
    user.coins -= coins;
    await user.save();

    const withdrawal = new Withdrawal({ userId: user._id, amountUSD, coinsDeducted: coins, paymentDetails });
    await withdrawal.save();

    return res.status(200).json({ success: true, message: 'Cash-out request submitted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};