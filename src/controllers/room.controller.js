const Room = require('../models/Room');

exports.getLiveRooms = async (req, res) => {
  try {
    // Fetch live rooms and populate owner's details
    const rooms = await Room.find({ status: 'live' })
      .populate('ownerId', 'name avatar arvindId')
      .sort({ activeUsers: -1, createdAt: -1 });

    res.status(200).json({
      message: 'Live rooms fetched successfully',
      rooms
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const { name, coverImage, tags, maxUsers } = req.body;
    const ownerId = req.user.userId; // Provided by authMiddleware

    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const newRoom = new Room({
      name,
      ownerId,
      coverImage: coverImage || '',
      tags: tags || [],
      maxUsers: maxUsers || 50,
      status: 'live',
      activeUsers: 1 // The owner is automatically in the room
    });

    await newRoom.save();

    res.status(201).json({ message: 'Room created successfully', room: newRoom });
  } catch (error) {
    console.error('Create Room Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};