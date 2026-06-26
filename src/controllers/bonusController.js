const Bonus = require('../models/Bonus');
const Agency = require('../models/Agency');
const User = require('../models/User');
const SalaryRecord = require('../models/SalaryRecord');
const AuditLog = require('../models/AuditLog');

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: AWARD BONUS TO HOST
// POST /api/agency/bonus/award
// ─────────────────────────────────────────────────────────────────────────
exports.awardBonus = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { hostId, reason, type, amount, vipTag, badgeId, month, year, notes } = req.body;

    if (!hostId || !reason || !amount) {
      return res.status(400).json({ success: false, message: 'hostId, reason and amount are required' });
    }

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (agency.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only agency owner can award bonuses' });
    }
    if (!agency.hosts.map(h => h.toString()).includes(hostId)) {
      return res.status(403).json({ success: false, message: 'User is not a host in your agency' });
    }

    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    const bonus = await Bonus.create({
      userId: hostId,
      agencyId: agency._id,
      awardedBy: userId,
      reason,
      type: type || 'coins',
      amount,
      vipTag: vipTag || '',
      badgeId: badgeId || '',
      month: m,
      year: y,
      notes: notes || '',
    });

    if (type === 'coins') {
      await User.findByIdAndUpdate(hostId, { $inc: { coins: amount } });
    }

    await AuditLog.create({
      userId,
      action: 'bonus_awarded',
      targetId: bonus._id,
      metadata: { hostId, agencyId: agency._id.toString(), amount, reason },
      ip: req.ip,
    });

    res.status(201).json({ success: true, bonus, message: 'Bonus awarded successfully' });
  } catch (error) {
    console.error('Award Bonus Error:', error);
    res.status(500).json({ success: false, message: 'Failed to award bonus' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: GET BONUSES FOR A HOST
// GET /api/agency/bonus/history/:hostId
// ─────────────────────────────────────────────────────────────────────────
exports.getHostBonuses = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { hostId } = req.params;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (!agency.hosts.map(h => h.toString()).includes(hostId)) {
      return res.status(403).json({ success: false, message: 'Host not in agency' });
    }

    const bonuses = await Bonus.find({ userId: hostId, agencyId: agency._id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, data: bonuses, count: bonuses.length });
  } catch (error) {
    console.error('Get Host Bonuses Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bonuses' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: GET MONTHLY BONUS SUMMARY
// GET /api/agency/bonus/summary
// ─────────────────────────────────────────────────────────────────────────
exports.getMonthlyBonusSummary = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { month, year } = req.query;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const bonuses = await Bonus.find({
      agencyId: agency._id,
      month: m,
      year: y,
    }).populate('userId', 'name avatar arvindId');

    const totalBonus = bonuses.reduce((sum, b) => sum + (b.type === 'coins' ? b.amount : 0), 0);

    res.status(200).json({
      success: true,
      data: bonuses,
      totalBonus,
      count: bonuses.length,
      month: m,
      year: y,
    });
  } catch (error) {
    console.error('Monthly Bonus Summary Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bonus summary' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: REMOVE BONUS
// DELETE /api/agency/bonus/:bonusId
// ─────────────────────────────────────────────────────────────────────────
exports.removeBonus = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { bonusId } = req.params;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (agency.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only agency owner can remove bonuses' });
    }

    const bonus = await Bonus.findOneAndDelete({ _id: bonusId, agencyId: agency._id });
    if (!bonus) return res.status(404).json({ success: false, message: 'Bonus not found' });

    if (bonus.type === 'coins') {
      await User.findByIdAndUpdate(bonus.userId, { $inc: { coins: -bonus.amount } });
    }

    await AuditLog.create({
      userId,
      action: 'bonus_removed',
      targetId: bonusId,
      metadata: { hostId: bonus.userId.toString(), reason: bonus.reason },
      ip: req.ip,
    });

    res.status(200).json({ success: true, message: 'Bonus removed successfully' });
  } catch (error) {
    console.error('Remove Bonus Error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove bonus' });
  }
};

module.exports = {};