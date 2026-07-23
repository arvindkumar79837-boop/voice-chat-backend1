const User = require('../models/User'); // Pulls from your existing User Schema
const badgeController = require('./badgeController');

exports.updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update properties
    if (name) user.name = name;
    if (avatar) user.avatar = avatar; // We will accept Base64 string for now
    user.isProfileComplete = true;

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        avatar: user.avatar,
        isProfileComplete: user.isProfileComplete
      }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getUserCenter = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    // Try to check and award badges automatically
    try {
      await badgeController.checkAndAwardBadges(userId);
    } catch (error) {
      console.log('Badge system not available, using fallback badges');
    }

    // Try to get user badges with unlock status
    let badges = [];
    try {
      badges = await badgeController.getUserBadges(userId);
    } catch (error) {
      console.log('Using fallback badges');
      // Fallback badges when MongoDB is not available
      badges = [
        { id: 'b1', name: 'Top Gifter', description: 'Gifted over 10k diamonds', iconPath: '💎', isUnlocked: false },
        { id: 'b2', name: 'Coin Collector', description: 'Earned over 50k coins', iconPath: '💰', isUnlocked: false },
        { id: 'b3', name: 'Level Master', description: 'Reached level 10', iconPath: '🏆', isUnlocked: false },
        { id: 'b4', name: 'Early Bird', description: 'Joined Arvind Party', iconPath: '🐦', isUnlocked: true }
      ];
    }

    // Get frames — catalog-driven from user's unlockedFrames
    const frameCatalog = [
      { id: 'f1', name: 'Default Ring', imagePath: 'ring' },
      { id: 'f2', name: 'Gold Ring', imagePath: 'gold_ring' },
      { id: 'f3', name: 'Diamond Ring', imagePath: 'diamond_ring' },
    ];
    const unlockedSet = new Set(user?.unlockedFrames || []);
    const frames = frameCatalog.map((f) => ({
      ...f,
      isUnlocked: unlockedSet.has(f.id),
      isEquipped: user?.equippedFrame === f.id,
    }));

    // Returning real structured response for the app to render dynamically
    res.status(200).json({
      levelInfo: { currentLevel: user?.level || 1, currentExp: 0, nextLevelExp: 100 },
      badges: badges,
      frames: frames
    });
  } catch (error) {
    console.error('User Center Error:', error);
    res.status(500).json({ error: 'Failed to load user center data' });
  }
};

exports.equipFrame = async (req, res) => {
  try {
    const { frameId } = req.body;
    const userId = req.user.userId;
    
    await User.findByIdAndUpdate(userId, { equippedFrame: frameId });
    
    res.status(200).json({ message: 'Frame equipped successfully', frameId });
  } catch (error) {
    console.error('Equip Frame Error:', error);
    res.status(500).json({ error: 'Failed to equip frame' });
  }
};

exports.getVipStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isVip = user.vipExpiry && new Date(user.vipExpiry) > new Date();
    
    res.status(200).json({
      vip: {
        isVip: isVip,
        level: isVip ? (user.vipLevel || 1) : 0,
        expiryDate: user.vipExpiry,
        perks: isVip ? ['Exclusive VIP Badge', 'Premium Entrance Effects', 'Special Chat Colors', 'Priority Support'] : []
      }
    });
  } catch (error) {
    console.error('VIP Status Error:', error);
    res.status(500).json({ error: 'Failed to load VIP status' });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactions = await require('../models/Transaction').find({ user: userId }).sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    console.error('Transaction History Error:', error);
    res.status(500).json({ error: 'Failed to load transaction history' });
  }
};