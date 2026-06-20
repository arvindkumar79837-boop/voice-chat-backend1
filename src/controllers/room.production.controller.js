const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');

/**
 * @desc    Get complete production room details (Room info + Active Members + Seats)
 * @route   GET /api/rooms/:id/details
 * @access  Private
 */
exports.getRoomDetails = async (req, res) => {
  try {
    const roomId = req.params.id;

    // 1. Fetch Room Core Details
    const room = await Room.findById(roomId).lean();
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found or closed by admin.' });
    }

    // 2. Aggregate active members (Performance optimized for scaling)
    const members = await RoomMember.aggregate([
      { $match: { roomId: room._id, isOnline: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          id: '$userId',
          name: '$userDetails.name',
          avatar: '$userDetails.avatar',
          role: 1,
          userLevel: '$userDetails.level',
          isMuted: 1,
          isOnMic: 1,
          familyTag: '$userDetails.familyTag',
          contribution: 1,
          joinedAt: 1
        }
      }
    ]);

    // 3. Send structured production payload
    return res.status(200).json({ success: true, data: { room, members } });
  } catch (error) {
    console.error('getRoomDetails Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching room data.' });
  }
};