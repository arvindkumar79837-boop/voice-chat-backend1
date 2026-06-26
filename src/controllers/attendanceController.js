const Attendance = require('../models/Attendance');
const Agency = require('../models/Agency');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// ─────────────────────────────────────────────────────────────────────────
// HOST: START LIVE SESSION
// POST /api/agency/attendance/start
// ─────────────────────────────────────────────────────────────────────────
exports.startSession = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { roomId } = req.body;

    const user = await User.findById(userId);
    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Not part of any agency' });
    if (user.role !== 'host') return res.status(403).json({ success: false, message: 'Only hosts can start attendance' });

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let attendance = await Attendance.findOne({ userId, date: dayStart });
    if (!attendance) {
      attendance = await Attendance.create({
        userId,
        agencyId: agency._id,
        date: dayStart,
        sessionStart: now,
        durationMinutes: 0,
        roomId: roomId || null,
        isPresent: true,
        isValidDay: false,
        totalDailyMinutes: 0,
      });
    } else if (attendance.sessionEnd && attendance.durationMinutes >= 120) {
      return res.status(400).json({ success: false, message: 'Attendance already completed for today' });
    } else {
      attendance.sessionStart = now;
      attendance.roomId = roomId || attendance.roomId;
      await attendance.save();
    }

    await AuditLog.create({
      userId,
      action: 'attendance_start',
      targetId: attendance._id,
      metadata: { roomId, agencyId: agency._id.toString() },
      ip: req.ip,
    });

    res.status(200).json({ success: true, attendance, message: 'Attendance session started' });
  } catch (error) {
    console.error('Start Session Error:', error);
    res.status(500).json({ success: false, message: 'Failed to start attendance' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// HOST: END LIVE SESSION
// POST /api/agency/attendance/end
// ─────────────────────────────────────────────────────────────────────────
exports.endSession = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const attendance = await Attendance.findOne({ userId, date: dayStart });
    if (!attendance) return res.status(404).json({ success: false, message: 'No active session found' });
    if (!attendance.sessionStart) return res.status(400).json({ success: false, message: 'Session not started' });
    if (attendance.sessionEnd) return res.status(400).json({ success: false, message: 'Session already ended' });

    attendance.sessionEnd = now;
    const sessionMins = Math.floor((now - attendance.sessionStart) / (1000 * 60));
    attendance.durationMinutes += sessionMins;
    attendance.totalDailyMinutes += sessionMins;

    if (attendance.totalDailyMinutes >= 120) {
      attendance.isValidDay = true;
    }

    await attendance.save();

    const agency = await Agency.findOne({ hosts: userId });
    if (agency && ioInstance) {
      ioInstance.to(`agency_${agency._id}`).emit('attendance_update', {
        userId,
        date: dayStart.toISOString(),
        totalDailyMinutes: attendance.totalDailyMinutes,
        isValidDay: attendance.isValidDay,
      });
    }

    res.status(200).json({
      success: true,
      attendance,
      message: 'Attendance session ended',
      todayMinutes: attendance.totalDailyMinutes,
      isValidDay: attendance.isValidDay,
    });
  } catch (error) {
    console.error('End Session Error:', error);
    res.status(500).json({ success: false, message: 'Failed to end attendance' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: GET ALL HOSTS LIVE ATTENDANCE
// GET /api/agency/attendance/live
// ─────────────────────────────────────────────────────────────────────────
exports.getLiveAttendance = async (req, res) => {
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
    }).populate('userId', 'name avatar arvindId');

    const hosts = await User.find({ _id: { $in: hostIds } }, 'name avatar arvindId').lean();

    const result = hosts.map(host => {
      const att = todayAttendance.find(a => a.userId._id.toString() === host._id.toString());
      return {
        ...host,
        status: att && att.sessionStart && !att.sessionEnd ? 'live' : (att && att.isValidDay ? 'done' : 'not_started'),
        minutesToday: att ? att.totalDailyMinutes : 0,
        isValidDay: att ? att.isValidDay : false,
      };
    });

    res.status(200).json({ success: true, data: result, count: result.length });
  } catch (error) {
    console.error('Live Attendance Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch live attendance' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: GET MONTHLY ATTENDANCE REPORT
// GET /api/agency/attendance/monthly
// ─────────────────────────────────────────────────────────────────────────
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { month, year } = req.query;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const records = await Attendance.find({
      agencyId: agency._id,
      date: { $gte: startDate, $lte: endDate },
    }).populate('userId', 'name avatar');

    const summary = {};
    records.forEach(rec => {
      const uid = rec.userId._id.toString();
      if (!summary[uid]) {
        summary[uid] = {
          userId: uid,
          name: rec.userId.name,
          avatar: rec.userId.avatar,
          totalMinutes: 0,
          validDays: 0,
          daysRecorded: 0,
        };
      }
      summary[uid].totalMinutes += rec.totalDailyMinutes;
      summary[uid].daysRecorded += 1;
      if (rec.isValidDay) summary[uid].validDays += 1;
    });

    const data = Object.values(summary);
    res.status(200).json({ success: true, data, count: data.length, month: m, year: y });
  } catch (error) {
    console.error('Monthly Attendance Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly attendance' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: GET HOST ATTENDANCE HISTORY
// GET /api/agency/attendance/history/:hostId
// ─────────────────────────────────────────────────────────────────────────
exports.getHostAttendanceHistory = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { hostId } = req.params;

    const agency = await Agency.findOne({ hosts: userId });
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    if (!agency.hosts.includes(hostId)) return res.status(403).json({ success: false, message: 'Host not in agency' });

    const history = await Attendance.find({ userId: hostId })
      .sort({ date: -1 })
      .limit(90);

    res.status(200).json({ success: true, data: history, count: history.length });
  } catch (error) {
    console.error('Host History Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch host history' });
  }
};

module.exports = { ioInstance: null };