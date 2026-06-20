const User = require('../models/User');

/**
 * @desc    Get all users with pagination and search
 * @route   GET /api/admin/users
 * @access  Private (Admin/Owner)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';

    const query = {};
    if (search) {
      query.$or = [
        { uid: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('uid name avatar level vipLevel diamonds coins isBanned banReason createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('getAllUsers Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * @desc    Ban or Unban a user
 * @route   POST /api/admin/users/ban
 * @access  Private (Admin/Owner)
 */
exports.toggleBanStatus = async (req, res) => {
  try {
    const { userId, isBanned, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Cannot ban an owner
    if (user.role === 'owner') {
      return res.status(403).json({ success: false, message: 'Cannot ban the system owner.' });
    }

    user.isBanned = isBanned;
    user.banReason = isBanned ? (reason || 'Violation of terms') : '';
    await user.save();

    // If banned, force disconnect socket if user is online
    const io = req.app.get('io');
    if (isBanned && io) {
      io.to(user._id.toString()).emit('force_logout', { message: user.banReason });
    }

    return res.status(200).json({ success: true, message: `User successfully ${isBanned ? 'banned' : 'unbanned'}.`, data: user });
  } catch (error) {
    console.error('toggleBanStatus Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};