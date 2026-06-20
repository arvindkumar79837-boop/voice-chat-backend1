const User = require('../models/User');

// GET /api/moderation/reports
exports.getReports = async (req, res) => {
  try {
    res.json({ success: true, reports: [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/safety/report
exports.reportContent = async (req, res) => {
  try {
    const { userId, roomId, reason } = req.body;
    res.json({ success: true, message: 'Report submitted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/social/block
exports.blockUser = async (req, res) => {
  try {
    const currentUserId = req.user?.id || req.body.currentUserId;
    const { userId } = req.body;
    if (!currentUserId || !userId) return res.status(400).json({ success: false, message: 'User IDs required' });
    await User.findByIdAndUpdate(currentUserId, { $addToSet: { blockedUsers: userId } });
    res.json({ success: true, message: 'User blocked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};