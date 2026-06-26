const mongoose = require('mongoose');
const Penalty = require('../models/Penalty');
const User = require('../models/User');
const Agency = require('../models/Agency');
const SalaryRecord = require('../models/SalaryRecord');
const AuditLog = require('../models/AuditLog');

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: APPLY PENALTY TO HOST
// POST /api/agency/penalty/apply
// ─────────────────────────────────────────────────────────────────────────
exports.applyPenalty = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { hostId, reason, type, amount, isPercentage, month, year, notes } = req.body;

    if (!hostId || !reason || !amount) {
      return res.status(400).json({ success: false, message: 'hostId, reason and amount are required' });
    }

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (agency.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only agency owner can apply penalties' });
    }
    if (!agency.hosts.map(h => h.toString()).includes(hostId)) {
      return res.status(403).json({ success: false, message: 'User is not a host in your agency' });
    }

    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    const penalty = await Penalty.create({
      userId: hostId,
      agencyId: agency._id,
      appliedBy: userId,
      reason,
      type: type || 'coins',
      amount,
      isPercentage: isPercentage || false,
      month: m,
      year: y,
      notes: notes || '',
    });

    await AuditLog.create({
      userId,
      action: 'penalty_applied',
      targetId: penalty._id,
      metadata: { hostId, agencyId: agency._id.toString(), amount, reason },
      ip: req.ip,
    });

    res.status(201).json({ success: true, penalty, message: 'Penalty applied successfully' });
  } catch (error) {
    console.error('Apply Penalty Error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply penalty' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: GET PENALTIES FOR A HOST
// GET /api/agency/penalty/history/:hostId
// ─────────────────────────────────────────────────────────────────────────
exports.getHostPenalties = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { hostId } = req.params;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (!agency.hosts.map(h => h.toString()).includes(hostId)) {
      return res.status(403).json({ success: false, message: 'Host not in agency' });
    }

    const penalties = await Penalty.find({ userId: hostId, agencyId: agency._id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, data: penalties, count: penalties.length });
  } catch (error) {
    console.error('Get Host Penalties Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch penalties' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: REMOVE PENALTY
// DELETE /api/agency/penalty/:penaltyId
// ─────────────────────────────────────────────────────────────────────────
exports.removePenalty = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { penaltyId } = req.params;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (agency.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only agency owner can remove penalties' });
    }

    const penalty = await Penalty.findOneAndDelete({ _id: penaltyId, agencyId: agency._id });
    if (!penalty) return res.status(404).json({ success: false, message: 'Penalty not found' });

    await AuditLog.create({
      userId,
      action: 'penalty_removed',
      targetId: penaltyId,
      metadata: { hostId: penalty.userId.toString(), reason: penalty.reason },
      ip: req.ip,
    });

    res.status(200).json({ success: true, message: 'Penalty removed successfully' });
  } catch (error) {
    console.error('Remove Penalty Error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove penalty' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: GET MONTHLY PENALTY SUMMARY
// GET /api/agency/penalty/summary
// ─────────────────────────────────────────────────────────────────────────
exports.getMonthlyPenaltySummary = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { month, year } = req.query;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const penalties = await Penalty.find({
      agencyId: agency._id,
      month: m,
      year: y,
    }).populate('userId', 'name avatar arvindId');

    const totalPenalty = penalties.reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      success: true,
      data: penalties,
      totalPenalty,
      count: penalties.length,
      month: m,
      year: y,
    });
  } catch (error) {
    console.error('Monthly Penalty Summary Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch penalty summary' });
  }
};

module.exports = {};