const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Withdrawal = require('../models/Withdrawal');
const Room = require('../models/Room');
const Moment = require('../models/Moment');
const Event = require('../models/Event');
const GlobalSetting = require('../models/GlobalSetting');
// ============================================================================
// DASHBOARD STATS
// ============================================================================

exports.getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalRooms,
      activeRooms,
      totalMoments,
      totalEvents,
      pendingWithdrawals,
      totalRevenueResult
    ] = await Promise.all([
      User.countDocuments(),
      Room.countDocuments(),
      Room.countDocuments({ status: 'active' }),
      Moment.countDocuments({ isDeleted: false }),
      Event.countDocuments(),
      Withdrawal.countDocuments({ status: 'pending_level_1' }),
      WalletTransaction.aggregate([
        { $match: { type: 'recharge', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amountInr' } } }
      ])
    ]);

    const totalRevenue = totalRevenueResult[0]?.total || 0;

    const recentTransactions = await WalletTransaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const recentUsers = await User.find()
      .select('uid name avatar level coins diamonds createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalRooms,
          activeRooms,
          totalMoments,
          totalEvents,
          pendingWithdrawals,
          totalRevenue
        },
        recentTransactions,
        recentUsers
      }
    });
  } catch (error) {
    console.error('getStats Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ============================================================================
// USER MANAGEMENT — extended from admin.user.controller.js
// ============================================================================

exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const role = req.query.role || '';

    const query = {};
    if (search) {
      query.$or = [
        { uid: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) {
      query.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('uid name avatar phone level vipLevel vipExpiry coins diamonds isBanned banReason role isActive createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('getUsers Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('getUserDetail Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('updateUser Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.toggleBan = async (req, res) => {
  try {
    const { userId, isBanned, reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'owner') {
      return res.status(403).json({ success: false, message: 'Cannot ban the owner' });
    }

    user.isBanned = isBanned;
    user.banReason = isBanned ? (reason || 'Violation of terms') : '';
    await user.save();

    const io = req.app.get('io');
    if (isBanned && io) {
      io.to(user._id.toString()).emit('force_logout', { message: user.banReason });
    }

    return res.status(200).json({
      success: true,
      message: `User ${isBanned ? 'banned' : 'unbanned'} successfully`,
      data: user
    });
  } catch (error) {
    console.error('toggleBan Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ============================================================================
// WALLET MANAGEMENT
// ============================================================================

exports.getWallets = async (req, res) => {
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

    const [wallets, total] = await Promise.all([
      User.find(query)
        .select('uid name avatar phone coins diamonds level vipLevel createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);

    const stats = await WalletTransaction.aggregate([
      {
        $group: {
          _id: null,
          totalRecharged: { $sum: { $cond: [{ $eq: ['$type', 'recharge'] }, '$amountInr', 0] } },
          totalGifted: { $sum: { $cond: [{ $eq: ['$type', 'gift_sent'] }, '$amount', 0] } },
          totalWithdrawn: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] } }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        wallets,
        stats: stats[0] || { totalRecharged: 0, totalGifted: 0, totalWithdrawn: 0 },
        pagination: { total, page, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('getWallets Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.adjustWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const { coins, diamonds, reason } = req.body;

    if (coins === undefined && diamonds === undefined) {
      return res.status(400).json({ success: false, message: 'Provide coins or diamonds to adjust' });
    }

    const $inc = {};
    if (coins !== undefined) $inc.coins = coins;
    if (diamonds !== undefined) $inc.diamonds = diamonds;

    const user = await User.findByIdAndUpdate(userId, { $inc }, { new: true }).select('uid name coins diamonds');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Log adjustment
    const actorId = req.user?.userId || 'system';
    await WalletTransaction.create({
      userId,
      type: 'admin',
      amount: coins || 0,
      description: reason || 'Admin wallet adjustment',
      metadata: {
        adjustedBy: actorId,
        diamondsAdjusted: diamonds || 0
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Wallet adjusted successfully',
      data: user
    });
  } catch (error) {
    console.error('adjustWallet Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getLiveRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ status: { $in: ['active', 'live'] } })
      .populate('ownerId', 'uid name username avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: rooms
    });
  } catch (error) {
    console.error('getLiveRooms Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getBans = async (req, res) => {
  try {
    const users = await User.find({ isBanned: true })
      .select('uid name username avatar email phone banReason bannedAt')
      .sort({ bannedAt: -1 });

    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('getBans Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.createBan = async (req, res) => {
  try {
    const { userId, reason } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isBanned = true;
    user.banReason = reason || 'Banned by admin';
    user.bannedAt = new Date();
    await user.save();

    return res.status(200).json({ success: true, message: 'User banned successfully', data: user });
  } catch (error) {
    console.error('createBan Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.liftBan = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isBanned = false;
    user.banReason = '';
    await user.save();

    return res.status(200).json({ success: true, message: 'Ban lifted successfully', data: user });
  } catch (error) {
    console.error('liftBan Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// Alias for GET /api/admin/settings (delegates to getGlobalSettings for clarity)
exports.getSettings = async (req, res) => {
  return exports.getGlobalSettings(req, res);
};

// Alias for PUT /api/admin/settings (delegates to updateGlobalSettings for clarity)
exports.updateSettings = async (req, res) => {
  return exports.updateGlobalSettings(req, res);
};

exports.getGlobalSettings = async (req, res) => {
  try {
    const settings = await GlobalSetting.findOne();
    return res.status(200).json({ success: true, data: settings || {} });
  } catch (error) {
    console.error('getGlobalSettings Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updateGlobalSettings = async (req, res) => {
  try {
    let settings = await GlobalSetting.findOne();
    if (!settings) {
      settings = new GlobalSetting();
    }

    Object.keys(req.body).forEach((key) => {
      if (key in settings.schema.paths || settings[key] !== undefined) {
        settings[key] = req.body[key];
      }
    });

    await settings.save();
    return res.status(200).json({ success: true, message: 'Global settings updated', data: settings });
  } catch (error) {
    console.error('updateGlobalSettings Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.adminSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const users = await User.find({
      $or: [
        { uid: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ]
    }).limit(20);

    return res.status(200).json({ success: true, data: { users } });
  } catch (error) {
    console.error('adminSearch Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};