const User = require('../models/User');
const ContentReport = require('../models/ContentReport');

// GET /api/moderation/reports — delegates to contentModerationController
exports.getReports = async (req, res) => {
  try {
    const { status, contentType, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (contentType) filter.contentType = contentType;
    const reports = await ContentReport.find(filter)
      .populate('reporterId', 'uid username displayName avatar')
      .populate('reportedUserId', 'uid username displayName avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await ContentReport.countDocuments(filter);
    return res.json({ success: true, data: reports, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/safety/report — delegates to contentModerationController
exports.reportContent = async (req, res) => {
  try {
    const reporterId = req.user?.id || req.user?.userId || req.body.userId;
    const { reportedUserId, reportedContentId, contentType, reason, description } = req.body;
    if (!reporterId) return res.status(400).json({ success: false, message: 'Authentication required' });
    if (!contentType || !reason) return res.status(400).json({ success: false, message: 'contentType and reason required' });
    const report = await ContentReport.create({ reporterId, reportedUserId, reportedContentId, contentType, reason, description });
    return res.json({ success: true, message: 'Report submitted', data: report });
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
