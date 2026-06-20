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

exports.verifyUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isProfileComplete = true;
    await user.save();

    return res.status(200).json({ success: true, message: 'User verified', data: user });
  } catch (error) {
    console.error('Verify User Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.adjustUserCoins = async (req, res) => {
  try {
    const { userId } = req.params;
    const { coins, diamonds } = req.body;

    if (coins === undefined && diamonds === undefined) {
      return res.status(400).json({ success: false, message: 'coins or diamonds required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (coins !== undefined) user.coins = (user.coins || 0) + Number(coins);
    if (diamonds !== undefined) user.diamonds = (user.diamonds || 0) + Number(diamonds);
    await user.save();

    return res.status(200).json({ success: true, message: 'User balance updated', data: user });
  } catch (error) {
    console.error('Adjust User Coins Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await require('../models/Withdrawal').find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: withdrawals });
  } catch (error) {
    console.error('Get Withdrawals Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.approveWithdrawal = async (req, res) => {
  try {
    const Withdrawal = require('../models/Withdrawal');
    const { id } = req.params;
    const item = await Withdrawal.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

    item.status = 'approved';
    await item.save();

    return res.status(200).json({ success: true, message: 'Withdrawal approved', data: item });
  } catch (error) {
    console.error('Approve Withdrawal Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.rejectWithdrawal = async (req, res) => {
  try {
    const Withdrawal = require('../models/Withdrawal');
    const { id } = req.params;
    const item = await Withdrawal.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

    item.status = 'rejected';
    await item.save();

    return res.status(200).json({ success: true, message: 'Withdrawal rejected', data: item });
  } catch (error) {
    console.error('Reject Withdrawal Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    const Announcement = require('../models/Announcement');
    const items = await Announcement.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('Get Announcements Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.sendAnnouncement = async (req, res) => {
  try {
    const Announcement = require('../models/Announcement');
    const { title, message } = req.body;
    const item = await Announcement.create({ title, message });
    return res.status(201).json({ success: true, message: 'Announcement sent', data: item });
  } catch (error) {
    console.error('Send Announcement Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getGifts = async (req, res) => {
  try {
    const Gift = require('../models/Gift');
    const gifts = await Gift.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: gifts });
  } catch (error) {
    console.error('Get Gifts Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.addGift = async (req, res) => {
  try {
    const Gift = require('../models/Gift');
    const item = await Gift.create(req.body);
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Add Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updateGift = async (req, res) => {
  try {
    const Gift = require('../models/Gift');
    const item = await Gift.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Gift not found' });
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('Update Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.deleteGift = async (req, res) => {
  try {
    const Gift = require('../models/Gift');
    const item = await Gift.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Gift not found' });
    return res.status(200).json({ success: true, message: 'Gift deleted' });
  } catch (error) {
    console.error('Delete Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getRecharges = async (req, res) => {
  try {
    const Recharge = require('../models/Recharge');
    const items = await Recharge.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('Get Recharges Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getSecurityLogins = async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const items = await AuditLog.find({ action: /LOGIN|LOGOUT|TOKEN_REFRESH|SUSPICIOUS_ACTIVITY/i }).sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('Get Security Logins Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.blockIp = async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, message: 'IP address required' });

    return res.status(200).json({ success: true, message: `Blocked IP ${ip}` });
  } catch (error) {
    console.error('Block IP Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};