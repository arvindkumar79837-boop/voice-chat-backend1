const User = require('../models/User');

exports.getTopWealth = async (req, res) => {
  try {
    // Find users with the highest diamonds (spending power / top gifters)
    const users = await User.find()
      .sort({ diamonds: -1 })
      .limit(20)
      .select('name avatar diamonds level vipLevel');

    res.status(200).json({ success: true, rankings: users });
  } catch (error) {
    console.error('Wealth Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch wealth rankings' });
  }
};

exports.getTopCharm = async (req, res) => {
  try {
    // Find users with the highest coins (received gifts / top hosts)
    const users = await User.find()
      .sort({ coins: -1 })
      .limit(20)
      .select('name avatar coins level vipLevel');

    res.status(200).json({ success: true, rankings: users });
  } catch (error) {
    console.error('Charm Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch charm rankings' });
  }
};

exports.getAdminLeaderboard = async (req, res) => {
  try {
    const users = await User.find()
      .select('uid name avatar coins diamonds level vipLevel createdAt')
      .sort({ coins: -1, diamonds: -1 })
      .limit(50);

    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Admin Leaderboard Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
};

exports.resetLeaderboard = async (req, res) => {
  try {
    await User.updateMany({}, { $set: { coins: 0, diamonds: 0 } });
    return res.status(200).json({ success: true, message: 'Leaderboard reset successfully' });
  } catch (error) {
    console.error('Reset Leaderboard Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset leaderboard' });
  }
};