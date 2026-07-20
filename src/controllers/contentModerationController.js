const mongoose = require('mongoose');
const ContentReport = require('../models/ContentReport');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const FLAGGED_KEYWORDS = [
  'spam', 'scam', 'hack', 'nude', 'xxx', 'porn', 'sex',
  'terrorist', 'bomb', 'kill yourself', 'kys', 'nigga',
];

exports.reportContent = async (req, res) => {
  try {
    const reporterId = req.user?.id || req.user?.userId || req.body.userId;
    const { reportedUserId, reportedContentId, contentType, reason, description, evidenceUrl } = req.body;

    if (!reporterId) return res.status(400).json({ success: false, message: 'Authentication required' });
    if (!contentType || !reason) return res.status(400).json({ success: false, message: 'contentType and reason required' });

    const report = await ContentReport.create({
      reporterId,
      reportedUserId,
      reportedContentId,
      contentType,
      reason,
      description,
      evidenceUrl,
    });

    return res.json({ success: true, message: 'Report submitted', data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const { status, contentType, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (contentType) filter.contentType = contentType;

    const reports = await ContentReport.find(filter)
      .populate('reporterId', 'uid username displayName avatar')
      .populate('reportedUserId', 'uid username displayName avatar')
      .populate('reviewedBy', 'uid name loginId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ContentReport.countDocuments(filter);

    return res.json({ success: true, data: reports, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolveReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { actionTaken } = req.body;
    const reviewedBy = req.user?.id || req.user?.userId;

    const validActions = ['NONE', 'WARNING', 'CONTENT_REMOVED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED'];
    if (actionTaken && !validActions.includes(actionTaken)) {
      return res.status(400).json({ success: false, message: `actionTaken must be one of: ${validActions.join(', ')}` });
    }

    const report = await ContentReport.findById(reportId);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    report.status = 'RESOLVED';
    report.actionTaken = actionTaken || 'NONE';
    report.reviewedBy = reviewedBy;
    report.reviewedAt = new Date();
    await report.save();

    if (report.reportedUserId && actionTaken && actionTaken !== 'NONE') {
      const updateFields = {};
      if (actionTaken === 'ACCOUNT_SUSPENDED') updateFields.accountStatus = 'suspended';
      if (actionTaken === 'ACCOUNT_BANNED') { updateFields.isBanned = true; updateFields.banReason = `Content violation: ${report.reason}`; updateFields.bannedAt = new Date(); }
      if (Object.keys(updateFields).length > 0) {
        await User.findByIdAndUpdate(report.reportedUserId, updateFields);
      }
    }

    await AuditLog.create({
      action: 'CONTENT_REPORT_RESOLVED',
      executorId: reviewedBy,
      reason: `Report ${report._id} resolved with action: ${actionTaken || 'NONE'}`,
      metadata: { reportId: report._id, contentType: report.contentType, reason: report.reason },
    });

    return res.json({ success: true, message: 'Report resolved', data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.dismissReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const reviewedBy = req.user?.id || req.user?.userId;

    const report = await ContentReport.findById(reportId);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    report.status = 'DISMISSED';
    report.reviewedBy = reviewedBy;
    report.reviewedAt = new Date();
    await report.save();

    return res.json({ success: true, message: 'Report dismissed', data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.autoModerate = async (text) => {
  if (!text || typeof text !== 'string') return { flagged: false, score: 0 };
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of FLAGGED_KEYWORDS) {
    if (lower.includes(kw)) score += 25;
  }
  return { flagged: score >= 50, score: Math.min(score, 100) };
};
