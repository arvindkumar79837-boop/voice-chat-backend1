const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const SalaryRecord = require('../models/SalaryRecord');
const Bonus = require('../models/Bonus');
const Penalty = require('../models/Penalty');
const Agency = require('../models/Agency');
const MonthlyReport = require('../models/MonthlyReport');
const Gift = require('../models/Gift');
const Transaction = require('../models/Transaction');

// ─────────────────────────────────────────────────────────────────────────
// AGENCY: GET REAL-TIME ANALYTICS DASHBOARD
// GET /api/agency/analytics/realtime
// ─────────────────────────────────────────────────────────────────────────
exports.getRealtimeAnalytics = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const hostIds = agency.hosts.map(h => h.toString());
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayAttendance = await Attendance.find({
      userId: { $in: hostIds },
      date: todayStart,
    });

    const liveHosts = [];
    const doneHosts = [];
    const notStartedHosts = [];

    todayAttendance.forEach(att => {
      if (att.sessionStart && !att.sessionEnd) {
        liveHosts.push({
          userId: att.userId.toString(),
          roomId: att.roomId,
          startTime: att.sessionStart,
          minutes: att.totalDailyMinutes,
        });
      } else if (att.isValidDay) {
        doneHosts.push({
          userId: att.userId.toString(),
          minutes: att.totalDailyMinutes,
        });
      } else {
        notStartedHosts.push({
          userId: att.userId.toString(),
          minutes: att.totalDailyMinutes,
        });
      }
    });

    const todayGifts = await Gift.find({
      toUserId: { $in: hostIds },
      createdAt: { $gte: todayStart },
    }).populate('fromUserId', 'name avatar');

    const todayGiftValue = todayGifts.reduce((sum, g) => sum + (g.diamondValue || 0), 0);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const monthGifts = await Gift.find({
      toUserId: { $in: hostIds },
      createdAt: { $gte: monthStart, $lte: monthEnd },
    });
    const monthGiftValue = monthGifts.reduce((sum, g) => sum + (g.diamondValue || 0), 0);

    const stats = {
      totalHosts: agency.hosts.length,
      liveNow: liveHosts.length,
      doneToday: doneHosts.length,
      notStarted: notStartedHosts.length,
      todayGiftsReceived: todayGifts.length,
      todayGiftValue,
      monthGiftsReceived: monthGifts.length,
      monthGiftValue,
      liveHosts,
      doneHosts,
      notStartedHosts,
      recentGifts: todayGifts.slice(0, 20),
    };

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('Realtime Analytics Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY: GET MONTHLY REPORT
// GET /api/agency/reports/monthly
// ─────────────────────────────────────────────────────────────────────────
exports.getMonthlyReport = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { month, year } = req.query;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    let report = await MonthlyReport.findOne({ agencyId: agency._id, month: m, year: y });

    if (!report) {
      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 0, 23, 59, 59);

      const attendances = await Attendance.find({
        agencyId: agency._id,
        date: { $gte: startDate, $lte: endDate },
        userId: { $in: agency.hosts },
      });

      const gifts = await Gift.find({
        toUserId: { $in: agency.hosts },
        createdAt: { $gte: startDate, $lte: endDate },
      });

      const salaryRecords = await SalaryRecord.find({
        agencyId: agency._id,
        month: m,
        year: y,
      });

      const penalties = await Penalty.find({
        agencyId: agency._id,
        month: m,
        year: y,
      });

      const bonuses = await Bonus.find({
        agencyId: agency._id,
        month: m,
        year: y,
      });

      const totalEarnings = gifts.reduce((sum, g) => sum + (g.diamondValue || 0), 0);
      const totalSalaryPaid = salaryRecords.reduce((sum, r) => sum + r.totalPaid, 0);
      const agencyCommissionEarned = totalEarnings * 0.1;
      const totalPenalties = penalties.length;
      const totalPenaltyAmount = penalties.reduce((sum, p) => sum + p.amount, 0);
      const totalBonuses = bonuses.length;
      const totalBonusAmount = bonuses.reduce((sum, b) => sum + (b.type === 'coins' ? b.amount : 0), 0);

      const uniqueHosts = new Set();
      const validDays = new Set();
      attendances.forEach(att => {
        uniqueHosts.add(att.userId.toString());
        if (att.isValidDay) validDays.add(`${att.userId}_${att.date}`);
      });

      report = await MonthlyReport.create({
        agencyId: agency._id,
        month: m,
        year: y,
        totalHosts: agency.hosts.length,
        totalActiveHosts: uniqueHosts.size,
        totalAttendanceDays: validDays.size,
        totalGiftsReceived: gifts.length,
        totalEarnings,
        totalSalaryPaid,
        agencyCommissionEarned,
        totalPenalties,
        totalBonuses,
        totalBonusAmount,
        totalPenaltyAmount,
      });
    }

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('Monthly Report Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY: GET DAILY EARNINGS CHART DATA
// GET /api/agency/reports/daily-chart
// ─────────────────────────────────────────────────────────────────────────
exports.getDailyChartData = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { month, year } = req.query;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const daysInMonth = new Date(y, m, 0).getDate();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const gifts = await Gift.find({
      toUserId: { $in: agency.hosts },
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const dailyData = new Array(daysInMonth).fill(0);
    gifts.forEach(gift => {
      const day = gift.createdAt.getDate() - 1;
      if (day >= 0 && day < daysInMonth) {
        dailyData[day] += gift.diamondValue || 0;
      }
    });

    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    res.status(200).json({
      success: true,
      data: { labels, values: dailyData, month: m, year: y },
    });
  } catch (error) {
    console.error('Daily Chart Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch chart data' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY: GET HOST PERFORMANCE RANKING
// GET /api/agency/reports/host-ranking
// ─────────────────────────────────────────────────────────────────────────
exports.getHostRanking = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { month, year, sortBy } = req.query;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const hosts = await User.find({ _id: { $in: agency.hosts } }, 'name avatar arvindId').lean();

    const rankings = await Promise.all(
      hosts.map(async (host) => {
        const attendance = await Attendance.find({
          userId: host._id,
          date: { $gte: startDate, $lte: endDate },
          isValidDay: true,
        });

        const gifts = await Gift.find({
          toUserId: host._id,
          createdAt: { $gte: startDate, $lte: endDate },
        });

        const totalMinutes = attendance.reduce((sum, a) => sum + a.totalDailyMinutes, 0);
        const totalGiftValue = gifts.reduce((sum, g) => sum + (g.diamondValue || 0), 0);

        return {
          userId: host._id.toString(),
          name: host.name,
          avatar: host.avatar,
          arvindId: host.arvindId,
          validDays: attendance.length,
          totalMinutes,
          giftsReceived: gifts.length,
          totalGiftValue,
          score: attendance.length * 10 + totalMinutes * 0.1 + totalGiftValue,
        };
      })
    );

    const sorted = rankings.sort((a, b) => {
      if (sortBy === 'minutes') return b.totalMinutes - a.totalMinutes;
      if (sortBy === 'gifts') return b.totalGiftValue - a.totalGiftValue;
      if (sortBy === 'days') return b.validDays - a.validDays;
      return b.score - a.score;
    });

    res.status(200).json({ success: true, data: sorted, count: sorted.length });
  } catch (error) {
    console.error('Host Ranking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch host ranking' });
  }
};

module.exports = {};