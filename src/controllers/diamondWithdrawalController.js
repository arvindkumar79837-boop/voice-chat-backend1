const Staff = require('../models/Staff');
const SystemSettings = require('../models/SystemSettings');
const DiamondWithdrawalRequest = require('../models/DiamondWithdrawalRequest');
const AuditLog = require('../models/AuditLog');

exports.requestWithdrawal = async (req, res) => {
  try {
    const staffId = req.user?.id || req.user?.userId;
    const { diamondsRequested } = req.body;

    if (!diamondsRequested || diamondsRequested < 1) {
      return res.status(400).json({ success: false, message: 'diamondsRequested must be >= 1' });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    const eligibleRoles = ['owner', 'super_admin', 'admin', 'finance_manager', 'official'];
    if (!eligibleRoles.includes(staff.role)) {
      return res.status(403).json({ success: false, message: 'Your role is not eligible for withdrawal' });
    }

    const minWithdrawal = await SystemSettings.getValue('diamond_withdrawal_min') || 50;
    if (diamondsRequested < minWithdrawal) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal is ${minWithdrawal} diamonds` });
    }

    if ((staff.diamonds || 0) < diamondsRequested) {
      return res.status(400).json({ success: false, message: `Insufficient diamonds. You have ${staff.diamonds || 0}` });
    }

    const dailyLimit = await SystemSettings.getValue('diamond_withdrawal_daily_limit') || 10000;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayTotal = await DiamondWithdrawalRequest.aggregate([
      { $match: { staffId: staff._id, createdAt: { $gte: todayStart }, status: { $in: ['PENDING', 'APPROVED', 'PAID'] } } },
      { $group: { _id: null, total: { $sum: '$diamondsRequested' } } },
    ]);
    const todaySum = (todayTotal[0]?.total || 0) + diamondsRequested;
    if (todaySum > dailyLimit) {
      return res.status(400).json({ success: false, message: `Daily limit exceeded. Remaining: ${dailyLimit - (todayTotal[0]?.total || 0)}` });
    }

    const payoutRatio = await SystemSettings.getValue('diamond_to_payout_ratio') || 1.0;
    const currencyLabel = await SystemSettings.getValue('payout_currency_label') || 'INR';
    const payoutAmount = diamondsRequested * payoutRatio;

    staff.diamonds -= diamondsRequested;
    await staff.save();

    const request = await DiamondWithdrawalRequest.create({
      staffId: staff._id,
      diamondsRequested,
      payoutRatioAtRequest: payoutRatio,
      payoutAmount,
      payoutCurrencyLabel: currencyLabel,
    });

    await AuditLog.create({
      action: 'DIAMOND_WITHDRAWAL_REQUESTED',
      executorId: staff._id,
      executorUid: staff.uid,
      reason: `${diamondsRequested} diamonds requested for withdrawal`,
      metadata: { requestId: request._id, payoutAmount, currencyLabel },
    });

    return res.json({ success: true, message: 'Withdrawal request submitted', data: request });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const staffId = req.user?.id || req.user?.userId;
    const requests = await DiamondWithdrawalRequest.find({ staffId }).sort({ createdAt: -1 });
    return res.json({ success: true, data: requests });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const requests = await DiamondWithdrawalRequest.find(filter)
      .populate('staffId', 'uid name loginId role diamonds')
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: requests });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const processedBy = req.user?.id || req.user?.userId;

    const request = await DiamondWithdrawalRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    request.status = 'APPROVED';
    request.processedBy = processedBy;
    request.processedAt = new Date();
    await request.save();

    await AuditLog.create({
      action: 'DIAMOND_WITHDRAWAL_APPROVED',
      executorId: processedBy,
      reason: `Approved ${request.diamondsRequested} diamond withdrawal`,
      metadata: { requestId: request._id },
    });

    return res.json({ success: true, message: 'Request approved', data: request });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.markPaid = async (req, res) => {
  try {
    const { requestId } = req.params;
    const processedBy = req.user?.id || req.user?.userId;

    const request = await DiamondWithdrawalRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: `Request must be APPROVED first. Current: ${request.status}` });
    }

    request.status = 'PAID';
    request.processedBy = processedBy;
    request.processedAt = new Date();
    request.notes = req.body.notes || request.notes;
    await request.save();

    await AuditLog.create({
      action: 'DIAMOND_WITHDRAWAL_PAID',
      executorId: processedBy,
      reason: `Paid ${request.payoutAmount} ${request.payoutCurrencyLabel} for ${request.diamondsRequested} diamonds`,
      metadata: { requestId: request._id },
    });

    return res.json({ success: true, message: 'Marked as paid', data: request });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const processedBy = req.user?.id || req.user?.userId;

    const request = await DiamondWithdrawalRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Cannot reject ${request.status} request` });
    }

    const staff = await Staff.findById(request.staffId);
    if (staff) {
      staff.diamonds = (staff.diamonds || 0) + request.diamondsRequested;
      await staff.save();
    }

    request.status = 'REJECTED';
    request.processedBy = processedBy;
    request.processedAt = new Date();
    request.notes = req.body.reason || 'Rejected by admin';
    await request.save();

    await AuditLog.create({
      action: 'DIAMOND_WITHDRAWAL_REJECTED',
      executorId: processedBy,
      reason: `Rejected ${request.diamondsRequested} diamond withdrawal`,
      metadata: { requestId: request._id },
    });

    return res.json({ success: true, message: 'Request rejected, diamonds refunded', data: request });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.clearNotification = async (req, res) => {
  try {
    const staffId = req.user?.id || req.user?.userId;
    const { requestId } = req.params;
    const request = await DiamondWithdrawalRequest.findOne({ _id: requestId, staffId });
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    request.notificationClearedByRequester = true;
    await request.save();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
