const Level = require('../models/User');

// GET /api/users/:id/level
exports.getUserLevel = async (req, res) => {
  try {
    const user = await Level.findById(req.params.id).select('level experience');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const expToNext = (user.level + 1) * 100;
    res.json({
      success: true,
      userLevel: user.level?.userLevel || 1,
      roomLevel: user.level?.roomLevel || 1,
      hostLevel: user.level?.hostLevel || 1,
      wealthLevel: user.level?.wealthLevel || 1,
      charmLevel: user.level?.charmLevel || 1,
      experience: user.experience || 0,
      expToNextLevel: expToNext,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/xp/add
exports.addExperience = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user?.id || req.body.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    const user = await Level.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.experience = (user.experience || 0) + amount;
    let leveledUp = false;
    const expNeeded = (user.level?.userLevel || 1) * 100;
    
    if (user.experience >= expNeeded) {
      user.experience -= expNeeded;
      if (!user.level) user.level = {};
      user.level.userLevel = (user.level.userLevel || 1) + 1;
      leveledUp = true;
    }
    await user.save();

    res.json({
      success: true,
      experience: user.experience,
      leveledUp,
      newLevel: user.level?.userLevel || 1,
      expToNextLevel: ((user.level?.userLevel || 1) + 1) * 100,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};