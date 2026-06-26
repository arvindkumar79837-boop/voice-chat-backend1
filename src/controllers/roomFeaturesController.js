const Room = require('../models/Room');
const RoomLevel = require('../models/RoomLevel');
const RoomFollower = require('../models/RoomFollower');
const User = require('../models/User');
const GiftTransaction = require('../models/GiftTransaction');
const RoomSeat = require('../models/RoomSeat');

const ROOM_LEADERBOARD_CACHE_TTL = 300;
const leaderboardCache = { daily: null, weekly: null, dailyAt: null, weeklyAt: null };

function getPrivacyMode(roomType) {
  if (roomType === 'PASSWORD') return 'password';
  if (roomType === 'PRIVATE') return 'private';
  return 'public';
}

async function getOnlineUserCount(roomId) {
  try {
    const seats = await RoomSeat.find({ roomId, userId: { $ne: null } });
    return seats.filter(s => s.userId).length;
  } catch {
    return 0;
  }
}

exports.createRoomWithDefaults = async (req, res) => {
  try {
    const { title, description, roomType, roomPassword, roomCategory, coverImage } = req.body;
    const ownerId = req.user._id;
    const roomId = Room.generateRoomId();

    const room = await Room.create({
      roomId,
      ownerId,
      title: title || 'My Voice Room',
      description: description || '',
      roomType: roomType || 'PUBLIC',
      roomPassword: roomPassword || '',
      roomCategory: roomCategory || 'voice',
      coverImage: coverImage || '',
      status: 'active',
      isLive: true,
      seatCount: 12
    });

    const roomLevel = await RoomLevel.create({
      roomId,
      currentLevel: 1,
      currentXp: 0,
      totalXpEarned: 0
    });

    await RoomFollower.create({
      roomId,
      userId: ownerId,
      userName: req.user.username || req.user.displayName || 'Owner',
      userAvatar: req.user.avatar || '',
      role: 'admin',
      isAdmin: true
    });

    return res.status(201).json({ success: true, data: { room, roomLevel } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.followRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const existing = await RoomFollower.findOne({ roomId, userId });
    if (existing) return res.status(400).json({ success: false, message: 'Already following this room' });

    const follower = await RoomFollower.create({
      roomId,
      userId,
      userName: req.user.username || req.user.displayName || 'User',
      userAvatar: req.user.avatar || ''
    });

    const roomLevel = await RoomLevel.findOne({ roomId });
    if (roomLevel) {
      await roomLevel.addXp('new_follower');
    }

    const followerCount = await RoomFollower.countDocuments({ roomId });

    return res.status(200).json({ success: true, data: { follower, followerCount } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.unfollowRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;
    const result = await RoomFollower.deleteOne({ roomId, userId });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Not following this room' });

    const followerCount = await RoomFollower.countDocuments({ roomId });
    return res.status(200).json({ success: true, data: { followerCount } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomFollowers = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const followers = await RoomFollower.find({ roomId })
      .sort({ lastActiveAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await RoomFollower.countDocuments({ roomId });

    return res.status(200).json({ success: true, data: { followers, total, page, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.promoteToAdmin = async (req, res) => {
  try {
    const { roomId, userId } = req.body;
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only room owner can promote admins' });
    }

    const roomLevel = await RoomLevel.findOne({ roomId });
    const levelConfig = RoomLevel.getLevelConfig(roomLevel ? roomLevel.currentLevel : 1);
    const adminCount = await RoomFollower.countDocuments({ roomId, role: 'admin' });
    if (adminCount >= levelConfig.adminSlots) {
      return res.status(400).json({ success: false, message: `Admin slot limit reached (${levelConfig.adminSlots}). Level up to increase.` });
    }

    const follower = await RoomFollower.findOneAndUpdate(
      { roomId, userId },
      { role: 'admin', isAdmin: true, promotedAt: new Date(), promotedBy: req.user._id },
      { new: true }
    );
    if (!follower) return res.status(404).json({ success: false, message: 'Follower not found' });

    if (!room.admins.includes(userId)) {
      room.admins.push(userId);
      await room.save();
    }

    return res.status(200).json({ success: true, data: follower });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.demoteAdmin = async (req, res) => {
  try {
    const { roomId, userId } = req.body;
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only room owner can demote admins' });
    }

    const follower = await RoomFollower.findOneAndUpdate(
      { roomId, userId },
      { role: 'member', isAdmin: false, promotedAt: null, promotedBy: null },
      { new: true }
    );

    room.admins = room.admins.filter(a => a.toString() !== userId.toString());
    await room.save();

    return res.status(200).json({ success: true, data: follower });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomAdminList = async (req, res) => {
  try {
    const { roomId } = req.params;
    const admins = await RoomFollower.find({ roomId, role: 'admin' })
      .populate('userId', 'username displayName avatar')
      .sort({ promotedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: admins });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomLevel = async (req, res) => {
  try {
    const { roomId } = req.params;
    let roomLevel = await RoomLevel.findOne({ roomId });
    if (!roomLevel) {
      roomLevel = await RoomLevel.create({ roomId });
    }
    const levelConfig = RoomLevel.getLevelConfig(roomLevel.currentLevel);
    const nextLevelConfig = roomLevel.currentLevel < 50 ? RoomLevel.getLevelConfig(roomLevel.currentLevel + 1) : null;

    return res.status(200).json({
      success: true,
      data: {
        ...roomLevel.toObject(),
        levelConfig,
        nextLevelConfig,
        xpProgress: nextLevelConfig ? (roomLevel.currentXp / nextLevelConfig.xpRequired) * 100 : 100
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.awardXp = async (req, res) => {
  try {
    const { roomId, action, multiplier } = req.body;
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    let roomLevel = await RoomLevel.findOne({ roomId });
    if (!roomLevel) roomLevel = await RoomLevel.create({ roomId });

    const result = await roomLevel.addXp(action, multiplier || 1);

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePrivacy = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { roomType, roomPassword } = req.body;
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only room owner can change privacy' });
    }

    room.roomType = roomType || room.roomType;
    if (roomPassword) room.roomPassword = roomPassword;
    await room.save();

    return res.status(200).json({ success: true, data: { roomId: room.roomId, roomType: room.roomType, privacyMode: getPrivacyMode(room.roomType) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyRoomPassword = async (req, res) => {
  try {
    const { roomId, password } = req.body;
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.roomType !== 'PASSWORD') {
      return res.status(200).json({ success: true, data: { access: true } });
    }
    const access = room.roomPassword === password;
    return res.status(200).json({ success: true, data: { access } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.setNotice = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { notice, marqueeText, welcomeMessage, pinnedMessage, topic } = req.body;
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.ownerId.toString() !== req.user._id.toString() && !room.admins.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only owner and admins can set notices' });
    }

    if (notice !== undefined) room.announcement = notice;
    if (marqueeText !== undefined) room.welcomeMessage = marqueeText;
    if (welcomeMessage !== undefined) room.welcomeMessage = welcomeMessage;
    if (pinnedMessage !== undefined) room.pinnedMessage = pinnedMessage;
    if (topic !== undefined) room.topic = topic;
    await room.save();

    return res.status(200).json({ success: true, data: { announcement: room.announcement, welcomeMessage: room.welcomeMessage, pinnedMessage: room.pinnedMessage, topic: room.topic } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId }).select('announcement welcomeMessage pinnedMessage topic').lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOnlineCount = async (req, res) => {
  try {
    const { roomId } = req.params;
    const count = await getOnlineUserCount(roomId);
    return res.status(200).json({ success: true, data: { roomId, onlineCount: count } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomLeaderboard = async (req, res) => {
  try {
    const { period } = req.params;
    const validPeriods = ['daily', 'weekly'];
    if (!validPeriods.includes(period)) return res.status(400).json({ success: false, message: 'Period must be daily or weekly' });

    const now = Date.now();
    const cacheKey = period;
    const cacheTime = period === 'daily' ? 60000 : 300000;

    if (leaderboardCache[cacheKey] && (now - (period === 'daily' ? leaderboardCache.dailyAt : leaderboardCache.weeklyAt)) < cacheTime) {
      return res.status(200).json({ success: true, data: leaderboardCache[cacheKey] });
    }

    const since = period === 'daily' ? new Date(now - 86400000) : new Date(now - 604800000);
    const pipeline = [
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$roomId', totalGiftValue: { $sum: '$giftValue' }, totalGifts: { $sum: 1 } } },
      { $sort: { totalGiftValue: -1 } },
      { $limit: 100 }
    ];

    const giftStats = await GiftTransaction.aggregate(pipeline);
    const roomIds = giftStats.map(g => g._id);
    const rooms = await Room.find({ roomId: { $in: roomIds } }).select('roomId title coverImage ownerId').lean();
    const ownerIds = rooms.map(r => r.ownerId);
    const owners = await User.find({ _id: { $in: ownerIds } }).select('username displayName avatar').lean();
    const ownerMap = {};
    owners.forEach(o => { ownerMap[o._id.toString()] = o; });

    const roomMap = {};
    rooms.forEach(r => { roomMap[r.roomId] = r; });

    const leaderboard = giftStats.map((g, index) => {
      const room = roomMap[g._id] || {};
      const owner = room.ownerId ? ownerMap[room.ownerId.toString()] : null;
      return {
        rank: index + 1,
        roomId: g._id,
        roomName: room.title || 'Unknown Room',
        coverImage: room.coverImage || '',
        ownerName: owner ? (owner.username || owner.displayName || 'Unknown') : 'Unknown',
        ownerAvatar: owner ? (owner.avatar || '') : '',
        totalGiftValue: g.totalGiftValue,
        totalGifts: g.totalGifts
      };
    });

    leaderboardCache[cacheKey] = leaderboard;
    if (period === 'daily') leaderboardCache.dailyAt = now;
    else leaderboardCache.weeklyAt = now;

    return res.status(200).json({ success: true, data: { period, leaderboard } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomLeaderboardByLevel = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const roomLevels = await RoomLevel.find()
      .sort({ currentLevel: -1, totalXpEarned: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await RoomLevel.countDocuments();

    const roomIds = roomLevels.map(rl => rl.roomId);
    const rooms = await Room.find({ roomId: { $in: roomIds } }).select('roomId title coverImage ownerId').lean();
    const roomMap = {};
    rooms.forEach(r => { roomMap[r.roomId] = r; });

    const leaderboard = roomLevels.map((rl, index) => {
      const room = roomMap[rl.roomId] || {};
      return {
        rank: skip + index + 1,
        roomId: rl.roomId,
        roomName: room.title || 'Unknown Room',
        coverImage: room.coverImage || '',
        level: rl.currentLevel,
        totalXp: rl.totalXpEarned
      };
    });

    return res.status(200).json({ success: true, data: { leaderboard, total, page, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.trackTimeSpent = async (req, res) => {
  try {
    const { roomId, minutes } = req.body;
    const userId = req.user._id;

    const follower = await RoomFollower.findOneAndUpdate(
      { roomId, userId },
      { $inc: { totalMinutesSpent: minutes, totalVisits: 0 }, lastActiveAt: new Date() },
      { new: true }
    );

    const roomLevel = await RoomLevel.findOne({ roomId });
    if (roomLevel) {
      for (let i = 0; i < minutes; i++) {
        await roomLevel.addXp('minute_spent');
      }
    }

    return res.status(200).json({ success: true, data: { totalMinutesSpent: follower ? follower.totalMinutesSpent : 0 } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyFollowedRooms = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const follows = await RoomFollower.find({ userId })
      .sort({ lastActiveAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const roomIds = follows.map(f => f.roomId);
    const rooms = await Room.find({ roomId: { $in: roomIds }, isActive: true })
      .select('roomId title coverImage roomType isLive activeUsers seatCount')
      .lean();

    const roomMap = {};
    rooms.forEach(r => { roomMap[r.roomId] = r; });

    const data = follows.map(f => ({
      ...roomMap[f.roomId] || {},
      role: f.role,
      isAdmin: f.isAdmin,
      joinedAt: f.joinedAt
    })).filter(d => d.roomId);

    const total = await RoomFollower.countDocuments({ userId });

    return res.status(200).json({ success: true, data: { rooms: data, total, page, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomDashboardInfo = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId }).lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const roomLevel = await RoomLevel.findOne({ roomId }).lean();
    const followerCount = await RoomFollower.countDocuments({ roomId });
    const adminCount = await RoomFollower.countDocuments({ roomId, role: 'admin' });
    const onlineCount = await getOnlineUserCount(roomId);

    let levelConfig = null;
    let nextLevelConfig = null;
    if (roomLevel) {
      levelConfig = RoomLevel.getLevelConfig(roomLevel.currentLevel);
      nextLevelConfig = roomLevel.currentLevel < 50 ? RoomLevel.getLevelConfig(roomLevel.currentLevel + 1) : null;
    }

    return res.status(200).json({
      success: true,
      data: {
        room,
        roomLevel: roomLevel ? { ...roomLevel, levelConfig, nextLevelConfig } : null,
        followerCount,
        adminCount,
        onlineCount,
        maxAdmins: levelConfig ? levelConfig.adminSlots : 8,
        maxSeats: levelConfig ? levelConfig.seatCapacity : 12
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};