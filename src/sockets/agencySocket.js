const User = require('../models/User');

function agencySocket(io) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (!userId) return;

    socket.on('join_agency', async ({ agencyId }) => {
      try {
        const Agency = require('../models/Agency');
        const agency = await Agency.findById(agencyId);
        if (!agency) return;

        if (!agency.hosts.includes(userId) && agency.owner.toString() !== userId) {
          return;
        }

        socket.join(`agency_${agencyId}`);
      } catch (error) {
        console.error('Join agency room error:', error);
      }
    });

    socket.on('agency_attendance_heartbeat', async ({ agencyId, roomId }) => {
      try {
        const Attendance = require('../models/Attendance');
        const now = new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const attendance = await Attendance.findOne({ userId, date: dayStart });
        if (attendance && !attendance.sessionEnd) {
          io.to(`agency_${agencyId}`).emit('attendance_heartbeat', {
            userId,
            roomId,
            timestamp: now.toISOString(),
          });
        }
      } catch (error) {
        console.error('Attendance heartbeat error:', error);
      }
    });

    socket.on('agency_live_update_request', async ({ agencyId }) => {
      try {
        const Agency = require('../models/Agency');
        const Attendance = require('../models/Attendance');
        const agency = await Agency.findById(agencyId);
        if (!agency) return;

        const hostIds = agency.hosts.map(h => h.toString());
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayAttendance = await Attendance.find({
          userId: { $in: hostIds },
          date: todayStart,
        }).populate('userId', 'name avatar arvindId');

        io.to(`agency_${agencyId}`).emit('live_attendance_update', { attendance: todayAttendance });
      } catch (error) {
        console.error('Live update request error:', error);
      }
    });

    socket.on('host_leave_agency', async ({ agencyId }) => {
      try {
        socket.leave(`agency_${agencyId}`);
      } catch (error) {
        console.error('Leave agency room error:', error);
      }
    });
  });
}

module.exports = agencySocket;