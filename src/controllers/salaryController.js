const mongoose = require('mongoose');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Gift = require('../models/Gift');
const SalaryRecord = require('../models/SalaryRecord');
const Penalty = require('../models/Penalty');
const Bonus = require('../models/Bonus');
const AgencyWallet = require('../models/AgencyWallet');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');

// ─────────────────────────────────────────────────────────────────────────
// CRON: CALCULATE MONTHLY SALARY FOR ALL HOSTS IN AN AGENCY
// POST /api/agency/salary/calculate-monthly
// ─────────────────────────────────────────────────────────────────────────
exports.calculateMonthlySalary = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { month, year } = req.query;

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear() - 1; // previous month by default for cron

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const agency = await Agency.findById(agencyId);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const hostIds = agency.hosts;
    const attendances = await Attendance.find({
      agencyId: agency._id,
      date: { $gte: startDate, $lte: endDate },
      userId: { $in: hostIds },
    }).lean();

    const gifts = await Gift.find({
      toUserId: { $in: hostIds },
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    const penalties = await Penalty.find({
      agencyId: agency._id,
      month: m,
      year: y,
      userId: { $in: hostIds },
    }).lean();

    const bonuses = await Bonus.find({
      agencyId: agency._id,
      month: m,
      year: y,
      userId: { $in: hostIds },
    }).lean();

    const summaryMap = {};
    hostIds.forEach(id => {
      summaryMap[id.toString()] = {
        userId: id,
        attendanceDays: 0,
        totalMinutes: 0,
        giftsReceived: 0,
        giftsValue: 0,
      };
    });

    attendances.forEach(att => {
      const uid = att.userId.toString();
      if (!summaryMap[uid]) summaryMap[uid] = { userId: att.userId, attendanceDays: 0, totalMinutes: 0, giftsReceived: 0, giftsValue: 0 };
      summaryMap[uid].attendanceDays += att.isValidDay ? 1 : 0;
      summaryMap[uid].totalMinutes += att.totalDailyMinutes;
    });

    gifts.forEach(g => {
      const uid = g.toUserId.toString();
      if (!summaryMap[uid]) summaryMap[uid] = { userId: g.toUserId, attendanceDays: 0, totalMinutes: 0, giftsReceived: 0, giftsValue: 0 };
      summaryMap[uid].giftsReceived += 1;
      summaryMap[uid].giftsValue += g.diamondValue || 0;
    });

    const salaryRecords = [];
    for (const hostId of hostIds) {
      const uid = hostId.toString();
      const user = await User.findById(hostId).select('name coins diamonds hostLevel');
      const data = summaryMap[uid] || { attendanceDays: 0, totalMinutes: 0, giftsReceived: 0, giftsValue: 0 };

      const hostPenalties = penalties.filter(p => p.userId.toString() === uid);
      const hostBonuses = bonuses.filter(b => b.userId.toString() === uid);

      let baseSalary = 2000;
      const bonusesTotal = hostBonuses.reduce((sum, b) => sum + (b.type === 'coins' ? b.amount : 0), 0);
      const penaltiesTotal = hostPenalties.reduce((sum, p) => {
        if (p.isPercentage) return sum + (baseSalary * p.amount / 100);
        return sum + p.amount;
      }, 0);

      const attendanceBonus = data.attendanceDays >= 25 ? 500 : data.attendanceDays >= 20 ? 300 : 0;
      const giftCommission = Math.floor(data.giftsValue * 0.05);
      const totalPaid = Math.max(0, baseSalary + bonusesTotal + attendanceBonus + giftCommission - penaltiesTotal);

      const record = await SalaryRecord.findOneAndUpdate(
        { userId: hostId, month: m, year: y },
        {
          userId: hostId,
          agencyId: agency._id,
          month: m,
          year: y,
          baseSalary,
          targetBonus: 0,
          attendanceBonus,
          giftCommission,
          penaltyDeduction: penaltiesTotal,
          bonus: bonusesTotal,
          totalPaid,
          attendanceDays: data.attendanceDays,
          attendanceMinutes: data.totalMinutes,
          giftsReceived: data.giftsReceived,
          hostLevel: user?.hostLevel || 'bronze',
          targetAchieved: data.attendanceDays >= 25,
          paymentStatus: 'pending',
          notes: `Auto-generated salary for ${m}/${y}`,
        },
        { new: true, upsert: true }
      );

      salaryRecords.push(record);
    }

    const wallet = await AgencyWallet.findOne({ agencyId: agency._id });
    const totalSalary = salaryRecords.reduce((sum, r) => sum + r.totalPaid, 0);

    if (wallet && wallet.balance >= totalSalary) {
      wallet.balance -= totalSalary;
      wallet.totalWithdrawn += totalSalary;
      await wallet.save();

      for (const record of salaryRecords) {
        if (record.totalPaid > 0) {
          record.paymentStatus = 'paid';
          record.paidAt = new Date();
          await record.save();

          await User.findByIdAndUpdate(record.userId, { $inc: { coins: record.totalPaid } });

          await Transaction.create({
            userId: record.userId,
            agencyId: agency._id,
            type: 'salary',
            amount: record.totalPaid,
            currency: 'coins',
            description: `Salary ${m}/${y}`,
            status: 'completed',
          });
        } else {
          record.paymentStatus = 'cancelled';
          await record.save();
        }
      }

      await AuditLog.create({
        userId: req.user?.id || null,
        action: 'salary_paid',
        targetId: agency._id,
        metadata: { month: m, year: y, totalSalary, count: salaryRecords.length },
        ip: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Monthly salary calculated',
      data: {
        month: m,
        year: y,
        totalSalary,
        records: salaryRecords.length,
        agencyBalance: wallet ? wallet.balance : 0,
      },
    });
  } catch (error) {
    console.error('Calculate Salary Error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate monthly salary' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY: GET SALARY HISTORY
// GET /api/agency/salary/history
// ─────────────────────────────────────────────────────────────────────────
exports.getSalaryHistory = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { month, year, hostId } = req.query;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const query = { agencyId: agency._id };
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (hostId) query.userId = hostId;

    const records = await SalaryRecord.find(query)
      .populate('userId', 'name avatar arvindId')
      .sort({ year: -1, month: -1 });

    res.status(200).json({ success: true, data: records, count: records.length });
  } catch (error) {
    console.error('Salary History Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch salary history' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY: GET SINGLE HOST SALARY DETAIL
// GET /api/agency/salary/detail/:hostId
// ─────────────────────────────────────────────────────────────────────────
exports.getHostSalaryDetail = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { hostId } = req.params;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (!agency.hosts.map(h => h.toString()).includes(hostId)) {
      return res.status(403).json({ success: false, message: 'Host not in your agency' });
    }

    const user = await User.findById(hostId).select('name avatar arvindId hostLevel');
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const currentSalary = await SalaryRecord.findOne({
      userId: hostId,
      agencyId: agency._id,
      month: currentMonth,
      year: currentYear,
    });

    const recentRecords = await SalaryRecord.find({ userId: hostId, agencyId: agency._id })
      .sort({ year: -1, month: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: {
        user,
        currentSalary: currentSalary || null,
        history: recentRecords,
      },
    });
  } catch (error) {
    console.error('Host Salary Detail Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch salary detail' });
  }
};

module.exports = {};