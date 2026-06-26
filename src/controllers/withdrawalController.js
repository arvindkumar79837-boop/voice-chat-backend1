const mongoose = require('mongoose');
const Agency = require('../models/Agency');
const AgencyWallet = require('../models/AgencyWallet');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: REQUEST WITHDRAWAL
// POST /api/agency/withdrawal/request
// ─────────────────────────────────────────────────────────────────────────
exports.requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { amount, currency, settlementMethod, accountDetails } = req.body;

    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (agency.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only agency owner can request withdrawal' });
    }

    const wallet = await AgencyWallet.findOne({ agencyId: agency._id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Agency wallet not found' });

    const reqCurrency = currency || 'coins';
    if (wallet.currency !== reqCurrency) {
      return res.status(400).json({ success: false, message: 'Currency mismatch with wallet' });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    const fee = Math.floor(amount * 0.02);
    const netAmount = amount - fee;

    const withdrawal = await Withdrawal.create({
      agencyId: agency._id,
      userId: agency.owner,
      amount,
      currency: reqCurrency,
      netAmount,
      fee,
      settlementMethod: settlementMethod || 'bank_transfer',
      accountDetails: accountDetails || {},
      status: 'pending',
    });

    wallet.pendingWithdrawal += amount;
    await wallet.save();

    await AuditLog.create({
      userId,
      action: 'withdrawal_requested',
      targetId: withdrawal._id,
      metadata: { amount, currency: reqCurrency, fee, netAmount },
      ip: req.ip,
    });

    res.status(201).json({ success: true, withdrawal, message: 'Withdrawal request submitted' });
  } catch (error) {
    console.error('Withdrawal Request Error:', error);
    res.status(500).json({ success: false, message: 'Failed to process withdrawal request' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: GET WITHDRAWAL HISTORY
// GET /api/agency/withdrawal/history
// ─────────────────────────────────────────────────────────────────────────
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { status } = req.query;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const query = { agencyId: agency._id };
    if (status) query.status = status;

    const withdrawals = await Withdrawal.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: withdrawals, count: withdrawals.length });
  } catch (error) {
    console.error('Withdrawal History Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawal history' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ADMIN: APPROVE WITHDRAWAL
// POST /api/agency/withdrawal/approve/:id
// ─────────────────────────────────────────────────────────────────────────
exports.approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id || req.user.userId;

    const withdrawal = await Withdrawal.findById(id);
    if (! withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Withdrawal already processed' });
    }

    const wallet = await AgencyWallet.findOne({ agencyId: withdrawal.agencyId });
    if (!wallet || wallet.balance < withdrawal.amount) {
      return res.status(400).json({ success: false, message: 'Insufficient agency balance' });
    }

    withdrawal.status = 'approved';
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();
    await withdrawal.save();

    wallet.balance -= withdrawal.amount;
    wallet.pendingWithdrawal -= withdrawal.amount;
    wallet.totalWithdrawn += withdrawal.amount;
    await wallet.save();

    await AuditLog.create({
      userId: adminId,
      action: 'withdrawal_approved',
      targetId: withdrawal._id,
      metadata: { agencyId: withdrawal.agencyId.toString(), amount: withdrawal.amount },
      ip: req.ip,
    });

    res.status(200).json({ success: true, withdrawal, message: 'Withdrawal approved' });
  } catch (error) {
    console.error('Approve Withdrawal Error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve withdrawal' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ADMIN: REJECT WITHDRAWAL
// POST /api/agency/withdrawal/reject/:id
// ─────────────────────────────────────────────────────────────────────────
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id || req.user.userId;

    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Withdrawal already processed' });
    }

    withdrawal.status = 'rejected';
    withdrawal.rejectedBy = adminId;
    withdrawal.rejectedAt = new Date();
    rejectionReason: reason || 'Administrative rejection',
    await withdrawal.save();

    const wallet = await AgencyWallet.findOne({ agencyId: withdrawal.agencyId });
    if (wallet) {
      wallet.pendingWithdrawal -= withdrawal.amount;
      await wallet.save();
    }

    await AuditLog.create({
      userId: adminId,
      action: 'withdrawal_rejected',
      targetId: withdrawal._id,
      metadata: { agencyId: withdrawal.agencyId.toString(), amount: withdrawal.amount, reason },
      ip: req.ip,
    });

    res.status(200).json({ success: true, message: 'Withdrawal rejected' });
  } catch (error) {
    console.error('Reject Withdrawal Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject withdrawal' });
  }
};

module.exports = {};