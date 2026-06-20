const Report = require('../models/Report');
const User = require('../models/User');
const Room = require('../models/Room');

const getLoggedInUserId = (req) => {
  return req.user?.id || req.user?.userId || req.user?._id || req.user?.uid || null;
};

const sendError = (res, statusCode, message, details = null) => {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
};

const buildReportQuery = (req) => {
  const query = {};
  const { status, search, reporterId, reportedUserId, roomId } = req.query;

  if (status) query.status = status;
  if (reporterId) query.reporterId = reporterId;
  if (reportedUserId) query.reportedUserId = reportedUserId;
  if (roomId) query.roomId = roomId;

  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [
      { reason: regex },
      { details: regex },
      { contentType: regex }
    ];
  }

  return query;
};

const populateReport = (query) => {
  return query
    .populate('reporterId', 'uid name username avatar role')
    .populate('reportedUserId', 'uid name username avatar role')
    .populate('roomId', 'roomId title ownerId status')
    .populate('reviewedBy', 'uid name username avatar role');
};

exports.createReport = async (req, res) => {
  try {
    const {
      reportedUserId,
      roomId,
      contentType = 'other',
      contentId,
      reason,
      details = ''
    } = req.body;

    const reporterId = req.body.reporterId || getLoggedInUserId(req);

    if (!reporterId || !reason) {
      return sendError(res, 400, 'Reporter and reason are required.');
    }

    if (!reportedUserId && !roomId && !contentId) {
      return sendError(res, 400, 'Please provide a target user, room, or content reference.');
    }

    const report = await Report.create({
      reporterId,
      reportedUserId: reportedUserId || null,
      roomId: roomId || null,
      contentType,
      contentId: contentId || null,
      reason,
      details
    });

    const populatedReport = await populateReport(Report.findById(report._id));

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully.',
      report: populatedReport
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to create report.', error.message);
  }
};

exports.getReports = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const query = buildReportQuery(req);

    const [reports, total] = await Promise.all([
      populateReport(
        Report.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
      ),
      Report.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0
      }
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch reports.', error.message);
  }
};

exports.getUserReports = async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId;
    if (!userId) {
      return sendError(res, 400, 'User ID is required.');
    }

    const reports = await populateReport(
      Report.find({
        $or: [
          { reporterId: userId },
          { reportedUserId: userId }
        ]
      }).sort({ createdAt: -1 })
    );

    return res.status(200).json({ success: true, reports });
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch user reports.', error.message);
  }
};

exports.resolveReport = async (req, res) => {
  try {
    if (req.method === 'DELETE' || req.query.action === 'delete') {
      return exports.deleteReport(req, res);
    }

    const reportId = req.params.id;
    const { status = 'resolved', reviewNote = '' } = req.body;

    if (!reportId) {
      return sendError(res, 400, 'Report ID is required.');
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return sendError(res, 404, 'Report not found.');
    }

    const allowedStatuses = ['resolved', 'dismissed'];
    const nextStatus = allowedStatuses.includes(status) ? status : 'resolved';
    const adminId = getLoggedInUserId(req);

    report.status = nextStatus;
    report.reviewNote = reviewNote || (nextStatus === 'resolved'
      ? 'Resolved by admin'
      : 'Dismissed by admin');
    report.reviewedBy = adminId || report.reviewedBy;
    report.reviewedAt = new Date();

    await report.save();

    const updatedReport = await populateReport(Report.findById(report._id));

    return res.status(200).json({
      success: true,
      message: 'Report resolved successfully.',
      report: updatedReport
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to resolve report.', error.message);
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const reportId = req.params.id || req.body.reportId;
    if (!reportId) {
      return sendError(res, 400, 'Report ID is required.');
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return sendError(res, 404, 'Report not found.');
    }

    await Report.findByIdAndDelete(reportId);

    return res.status(200).json({
      success: true,
      message: 'Report deleted successfully.'
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to delete report.', error.message);
  }
};