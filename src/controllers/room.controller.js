const Room = require('../models/Room');

const getOwnerId = (req) => {
  return req.user?.id || req.user?.userId || req.user?._id || null;
};

const generateRoomId = () => {
  return `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

exports.getLiveRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      status: { $in: ['active', 'live'] }
    })
      .populate('ownerId', 'uid name username avatar arvindId')
      .sort({ activeUsers: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Live rooms fetched successfully',
      rooms
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch live rooms.',
      error: error.message
    });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const {
      title,
      description = '',
      coverImage = '',
      tags = [],
      language = 'English',
      roomType = 'public',
      password = ''
    } = req.body;

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to create a room.'
      });
    }

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Room title is required.'
      });
    }

    const room = await Room.create({
      roomId: generateRoomId(),
      ownerId,
      title: String(title).trim(),
      description,
      coverImage,
      tags: Array.isArray(tags) ? tags : [],
      language,
      roomType,
      password,
      status: 'active',
      activeUsers: 1
    });

    return res.status(201).json({
      success: true,
      message: 'Room created successfully',
      room
    });
  } catch (error) {
    console.error('Create Room Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create room.',
      error: error.message
    });
  }
};