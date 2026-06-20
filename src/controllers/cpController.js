const CpPair = require('../models/CpPair');
const User = require('../models/User');

exports.getMyCp = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    
    // Find any active CP relationship for this user
    const cpData = await CpPair.findOne({
      $or: [{ user1Id: userId }, { user2Id: userId }],
      isActive: true
    }).populate('user1Id', 'name avatar').populate('user2Id', 'name avatar');

    if (!cpData) {
      return res.status(200).json({ success: true, cpPair: null, message: "No active CP relationship" });
    }

    res.status(200).json({ success: true, cpPair: cpData });
  } catch (error) {
    console.error('Get CP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch CP details' });
  }
};

exports.bindCp = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id || req.user.userId;

    // In production: Create a CP Request, then target user accepts it.
    // For now, we directly bind them to replace the fake data immediately.
    const newCp = await CpPair.create({ user1Id: userId, user2Id: targetUserId });
    res.status(201).json({ success: true, cpPair: newCp, message: "Successfully bound as CP!" });
  } catch (error) {
    console.error('Bind CP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to bind CP' });
  }
};