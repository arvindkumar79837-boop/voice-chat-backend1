const Room = require('../models/Room');
const User = require('../models/User');
const crypto = require('crypto');

const getOwnerId = (req) => {
  return req.user?.id || req.user?.userId || req.user?._id || null;
};

const getUserId = (req) => {
  return req.user?.id || req.user?.userId || req.user?._id || null;
};

// ────────────────────────────────────────────────────────────────
// SECTION 71: ROOM VARIETIES & USE CASES
// ────────────────────────────────────────────────────────────────

/**
 * @desc    Create a room (PUBLIC, PRIVATE, PASSWORD, THEME, KARAOKE, GAME, FAMILY, AGENCY)
 * @route   POST /api/rooms/create
 */
exports.createRoom = async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    if (!ownerId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const {
      title,
      description = '',
      coverImage = '',
      tags = [],
      language = 'English',
      roomType = 'PUBLIC',
      roomPassword = '',
      roomCategory = 'voice',
      seatCount = 8,
      backgroundUrl = '',
      familyId = null,
      agencyId = null
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Room title is required.' });
    }

    const validRoomTypes = ['PUBLIC', 'PRIVATE', 'PASSWORD', 'THEME', 'KARAOKE', 'GAME', 'FAMILY', 'AGENCY'];
    const normalizedType = roomType.toUpperCase();
    if (!validRoomTypes.includes(normalizedType)) {
      return res.status(400).json({ success: false, message: 'Invalid room type.' });
    }

    // Validate password for PASSWORD rooms
    if (normalizedType === 'PASSWORD') {
      if (!roomPassword || roomPassword.length !== 4) {
        return res.status(400).json({ success: false, message: '4-digit password is required for password rooms.' });
      }
    }

    // Validate family/agency association
    if (normalizedType === 'FAMILY' && !familyId) {
      return res.status(400).json({ success: false, message: 'Family ID is required for family rooms.' });
    }
    if (normalizedType === 'AGENCY' && !agencyId) {
      return res.status(400).json({ success: false, message: 'Agency ID is required for agency rooms.' });
    }

    const seatCountNum = Math.min(Math.max(parseInt(seatCount) || 8, 2), 32);

    // Generate seats matrix
    const seats = [];
    for (let i = 0; i < seatCountNum; i++) {
      seats.push({
        seatIndex: i,
        userId: i === 0 ? ownerId : null,
        userName: i === 0 ? (req.user?.username || req.user?.name || 'Host') : '',
        userAvatar: i === 0 ? (req.user?.avatar || '') : '',
        isMuted: false,
        isLocked: false,
        isHost: i === 0,
        joinedAt: i === 0 ? new Date() : null
      });
    }

    // Generate unique room ID
    const roomId = Room.generateRoomId();

    // Encrypt password if provided
    let encryptedPassword = '';
    if (roomPassword) {
      encryptedPassword = crypto.createHash('sha256').update(roomPassword).digest('hex').substring(0, 16);
    }

    const room = await Room.create({
      roomId,
      ownerId,
      title: String(title).trim(),
      description,
      coverImage,
      tags: Array.isArray(tags) ? tags : [],
      language,
      roomType: normalizedType,
      roomPassword: encryptedPassword,
      roomCategory,
      seatCount: seatCountNum,
      seats,
      status: 'active',
      isLive: true,
      activeUsers: 1,
      liveKitRoom: `arvind_${roomId}`,
      cosmetics: {
        backgroundUrl: backgroundUrl || '',
        backgroundName: 'Default',
        themeColor: '#FF6B6B',
        isAnimated: false,
        purchasedBackgrounds: []
      },
      dailyTasks: generateDailyTasks(),
      familyId: normalizedType === 'FAMILY' ? familyId : null,
      agencyId: normalizedType === 'AGENCY' ? agencyId : null,
      coHosts: [],
      admins: []
    });

    // Populate owner details
    await room.populate('ownerId', 'uid name username avatar arvindId');

    return res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      room
    });
  } catch (error) {
    console.error('Create Room Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create room.', error: error.message });
  }
};

/**
 * @desc    Get all live/active rooms with filtering
 * @route   GET /api/rooms/live?type=PUBLIC&category=voice&page=1&limit=20
 */
exports.getLiveRooms = async (req, res) => {
  try {
    const { type, category, search, page = 1, limit = 20 } = req.query;
    const query = { status: { $in: ['active', 'live'] }, isActive: true };

    if (type) query.roomType = type.toUpperCase();
    if (category) query.roomCategory = category;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalRooms = await Room.countDocuments(query);

    const rooms = await Room.find(query)
      .populate('ownerId', 'uid name username avatar arvindId')
      .populate('familyId', 'name')
      .populate('agencyId', 'name')
      .sort({ isLive: -1, activeUsers: -1, totalGiftPoints: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Remove password field from response
    const sanitizedRooms = rooms.map(room => {
      const { roomPassword, ...rest } = room;
      return { ...rest, hasPassword: !!roomPassword };
    });

    return res.status(200).json({
      success: true,
      message: 'Rooms fetched successfully.',
      rooms: sanitizedRooms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRooms,
        pages: Math.ceil(totalRooms / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get Live Rooms Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch rooms.', error: error.message });
  }
};

/**
 * @desc    Get rooms by type (for browsing different room categories)
 * @route   GET /api/rooms/type/:roomType
 */
exports.getRoomsByType = async (req, res) => {
  try {
    const { roomType } = req.params;
    const validRoomTypes = ['PUBLIC', 'PRIVATE', 'PASSWORD', 'THEME', 'KARAOKE', 'GAME', 'FAMILY', 'AGENCY'];

    if (!validRoomTypes.includes(roomType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid room type.' });
    }

    const rooms = await Room.find({
      roomType: roomType.toUpperCase(),
      status: { $in: ['active', 'live'] },
      isActive: true
    })
      .populate('ownerId', 'uid name username avatar arvindId')
      .sort({ activeUsers: -1 })
      .limit(50)
      .lean();

    const sanitizedRooms = rooms.map(room => {
      const { roomPassword, ...rest } = room;
      return { ...rest, hasPassword: !!roomPassword };
    });

    return res.status(200).json({ success: true, rooms: sanitizedRooms });
  } catch (error) {
    console.error('Get Rooms By Type Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch rooms by type.', error: error.message });
  }
};

/**
 * @desc    Get room detail by roomId
 * @route   GET /api/rooms/:roomId
 */
exports.getRoomDetail = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId })
      .populate('ownerId', 'uid name username avatar arvindId level')
      .populate('familyId', 'name avatar')
      .populate('agencyId', 'name')
      .populate('coHosts', 'uid name username avatar')
      .populate('admins', 'uid name username avatar')
      .lean();

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const { roomPassword, ...rest } = room;

    return res.status(200).json({
      success: true,
      room: { ...rest, hasPassword: !!roomPassword }
    });
  } catch (error) {
    console.error('Get Room Detail Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch room details.', error: error.message });
  }
};

/**
 * @desc    Join a room (validates password for PASSWORD rooms)
 * @route   POST /api/rooms/:roomId/join
 */
exports.joinRoom = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId } = req.params;
    const { password } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (!room.isActive || room.status === 'banned') {
      return res.status(403).json({ success: false, message: 'This room is no longer active.' });
    }

    // Check if user is kicked
    if (room.kickedUsers.some(id => id.toString() === userId.toString())) {
      return res.status(403).json({ success: false, message: 'You have been kicked from this room.' });
    }

    // Validate password for PASSWORD rooms
    if (room.roomType === 'PASSWORD') {
      const hashedInput = crypto.createHash('sha256').update(password || '').digest('hex').substring(0, 16);
      if (hashedInput !== room.roomPassword) {
        return res.status(403).json({ success: false, message: 'Incorrect room password.' });
      }
    }

    // User can join (no actual seat claim here, just entry validation)
    return res.status(200).json({
      success: true,
      message: 'Room access granted.',
      room: {
        roomId: room.roomId,
        title: room.title,
        roomType: room.roomType,
        liveKitRoom: room.liveKitRoom,
        seatCount: room.seatCount
      }
    });
  } catch (error) {
    console.error('Join Room Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to join room.', error: error.message });
  }
};

/**
 * @desc    Verify room password (separate endpoint for password rooms)
 * @route   POST /api/rooms/:roomId/verify-password
 */
exports.verifyPassword = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { password } = req.body;

    if (!password || password.length !== 4) {
      return res.status(400).json({ success: false, message: '4-digit password is required.' });
    }

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (room.roomType !== 'PASSWORD') {
      return res.status(400).json({ success: false, message: 'This is not a password-protected room.' });
    }

    const hashedInput = crypto.createHash('sha256').update(password).digest('hex').substring(0, 16);
    const isValid = hashedInput === room.roomPassword;

    return res.status(200).json({
      success: isValid,
      message: isValid ? 'Password correct.' : 'Incorrect password.'
    });
  } catch (error) {
    console.error('Verify Password Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify password.', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────────
// SECTION 72: ADVANCED SEAT & MICROPHONE CONTROLS
// ────────────────────────────────────────────────────────────────

/**
 * @desc    Lock/unlock a seat (owner/admin only)
 * @route   POST /api/rooms/:roomId/seats/:seatIndex/lock
 */
exports.toggleSeatLock = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId, seatIndex } = req.params;
    const seatIdx = parseInt(seatIndex);

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // Check permissions (owner, co-host, or admin)
    const isAuthorized = room.ownerId.toString() === userId.toString() ||
      room.coHosts.some(id => id.toString() === userId.toString()) ||
      room.admins.some(id => id.toString() === userId.toString());

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Only the room owner or admin can lock/unlock seats.' });
    }

    if (seatIdx < 0 || seatIdx >= room.seats.length) {
      return res.status(400).json({ success: false, message: 'Invalid seat index.' });
    }

    const newLocked = !room.seats[seatIdx].isLocked;
    room.seats[seatIdx].isLocked = newLocked;

    await room.save();

    return res.status(200).json({
      success: true,
      message: `Seat ${seatIdx + 1} ${newLocked ? 'locked' : 'unlocked'}.`,
      seat: room.seats[seatIdx]
    });
  } catch (error) {
    console.error('Toggle Seat Lock Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle seat lock.', error: error.message });
  }
};

/**
 * @desc    Mute/unmute a seat (owner/admin only)
 * @route   POST /api/rooms/:roomId/seats/:seatIndex/mute
 */
exports.toggleSeatMute = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId, seatIndex } = req.params;
    const seatIdx = parseInt(seatIndex);

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const isAuthorized = room.ownerId.toString() === userId.toString() ||
      room.coHosts.some(id => id.toString() === userId.toString()) ||
      room.admins.some(id => id.toString() === userId.toString());

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Only the room owner or admin can mute/unmute seats.' });
    }

    if (seatIdx < 0 || seatIdx >= room.seats.length) {
      return res.status(400).json({ success: false, message: 'Invalid seat index.' });
    }

    const newMuted = !room.seats[seatIdx].isMuted;
    room.seats[seatIdx].isMuted = newMuted;

    await room.save();

    return res.status(200).json({
      success: true,
      message: `Seat ${seatIdx + 1} ${newMuted ? 'muted' : 'unmuted'}.`,
      seat: room.seats[seatIdx]
    });
  } catch (error) {
    console.error('Toggle Seat Mute Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle seat mute.', error: error.message });
  }
};

/**
 * @desc    Claim a seat for a user
 * @route   POST /api/rooms/:roomId/seats/:seatIndex/claim
 */
exports.claimSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId, seatIndex } = req.params;
    const seatIdx = parseInt(seatIndex);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (seatIdx < 0 || seatIdx >= room.seats.length) {
      return res.status(400).json({ success: false, message: 'Invalid seat index.' });
    }

    const seat = room.seats[seatIdx];

    // Check if seat is locked
    if (seat.isLocked) {
      return res.status(403).json({ success: false, message: 'This seat is locked.' });
    }

    // Check if seat is already occupied
    if (seat.userId) {
      return res.status(409).json({ success: false, message: 'This seat is already occupied.' });
    }

    // Remove user from any existing seat first
    const existingSeatIdx = room.seats.findIndex(s => s.userId && s.userId.toString() === userId.toString());
    if (existingSeatIdx !== -1) {
      room.seats[existingSeatIdx].userId = null;
      room.seats[existingSeatIdx].userName = '';
      room.seats[existingSeatIdx].userAvatar = '';
      room.seats[existingSeatIdx].isMuted = false;
      room.seats[existingSeatIdx].isHost = false;
      room.seats[existingSeatIdx].joinedAt = null;
    }

    // Assign seat to user
    room.seats[seatIdx].userId = userId;
    room.seats[seatIdx].userName = req.user?.username || req.user?.name || 'User';
    room.seats[seatIdx].userAvatar = req.user?.avatar || '';
    room.seats[seatIdx].isMuted = false;
    room.seats[seatIdx].isHost = userId.toString() === room.ownerId.toString();
    room.seats[seatIdx].joinedAt = new Date();

    await room.save();

    return res.status(200).json({
      success: true,
      message: `Seat ${seatIdx + 1} claimed successfully.`,
      seat: room.seats[seatIdx]
    });
  } catch (error) {
    console.error('Claim Seat Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to claim seat.', error: error.message });
  }
};

/**
 * @desc    Release/leave a seat
 * @route   POST /api/rooms/:roomId/seats/:seatIndex/release
 */
exports.releaseSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId, seatIndex } = req.params;
    const seatIdx = parseInt(seatIndex);

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (seatIdx < 0 || seatIdx >= room.seats.length) {
      return res.status(400).json({ success: false, message: 'Invalid seat index.' });
    }

    const seat = room.seats[seatIdx];
    if (seat.userId && seat.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only release your own seat.' });
    }

    room.seats[seatIdx].userId = null;
    room.seats[seatIdx].userName = '';
    room.seats[seatIdx].userAvatar = '';
    room.seats[seatIdx].isMuted = false;
    room.seats[seatIdx].isHost = false;
    room.seats[seatIdx].joinedAt = null;

    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Seat released.',
      seat: room.seats[seatIdx]
    });
  } catch (error) {
    console.error('Release Seat Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to release seat.', error: error.message });
  }
};

/**
 * @desc    Kick user from a seat (owner/admin only)
 * @route   POST /api/rooms/:roomId/seats/:seatIndex/kick
 */
exports.kickFromSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId, seatIndex } = req.params;
    const seatIdx = parseInt(seatIndex);

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const isAuthorized = room.ownerId.toString() === userId.toString() ||
      room.coHosts.some(id => id.toString() === userId.toString());

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Only the room owner or co-host can kick users from seats.' });
    }

    if (seatIdx < 0 || seatIdx >= room.seats.length) {
      return res.status(400).json({ success: false, message: 'Invalid seat index.' });
    }

    const kickedUserId = room.seats[seatIdx].userId;
    room.seats[seatIdx].userId = null;
    room.seats[seatIdx].userName = '';
    room.seats[seatIdx].userAvatar = '';
    room.seats[seatIdx].isMuted = false;
    room.seats[seatIdx].isHost = false;
    room.seats[seatIdx].joinedAt = null;

    if (kickedUserId) {
      room.kickedUsers.push(kickedUserId);
    }

    await room.save();

    return res.status(200).json({
      success: true,
      message: 'User kicked from seat.',
      seat: room.seats[seatIdx]
    });
  } catch (error) {
    console.error('Kick From Seat Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to kick user from seat.', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────────
// SECTION 73: ROOM COSMETICS & ENGAGEMENT
// ────────────────────────────────────────────────────────────────

/**
 * @desc    Update room background/cosmetics
 * @route   PUT /api/rooms/:roomId/cosmetics
 */
exports.updateCosmetics = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId } = req.params;
    const { backgroundUrl, backgroundName, themeColor, isAnimated } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (room.ownerId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room owner can update cosmetics.' });
    }

    if (backgroundUrl) room.cosmetics.backgroundUrl = backgroundUrl;
    if (backgroundName) room.cosmetics.backgroundName = backgroundName;
    if (themeColor) room.cosmetics.themeColor = themeColor;
    if (isAnimated !== undefined) room.cosmetics.isAnimated = isAnimated;

    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Room cosmetics updated.',
      cosmetics: room.cosmetics
    });
  } catch (error) {
    console.error('Update Cosmetics Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update cosmetics.', error: error.message });
  }
};

/**
 * @desc    Purchase a background from the store
 * @route   POST /api/rooms/:roomId/cosmetics/purchase-background
 */
exports.purchaseBackground = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId } = req.params;
    const { backgroundId, backgroundName, backgroundUrl, costCoins } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (room.ownerId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room owner can purchase backgrounds.' });
    }

    // Check if already purchased
    const alreadyOwned = room.cosmetics.purchasedBackgrounds.some(b => b.backgroundId === backgroundId);
    if (alreadyOwned) {
      return res.status(400).json({ success: false, message: 'Background already owned.' });
    }

    // Deduct coins from user (implement coin deduction logic here)
    // const user = await User.findById(userId);
    // if (user.coins < costCoins) return res.status(400).json({ ... });

    room.cosmetics.purchasedBackgrounds.push({
      backgroundId,
      backgroundName,
      backgroundUrl,
      purchasedAt: new Date()
    });

    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Background purchased successfully.',
      purchasedBackgrounds: room.cosmetics.purchagedBackgrounds
    });
  } catch (error) {
    console.error('Purchase Background Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to purchase background.', error: error.message });
  }
};

/**
 * @desc    Get room ranking (leaderboard)
 * @route   GET /api/rooms/ranking?type=gift&limit=50
 */
exports.getRoomRanking = async (req, res) => {
  try {
    const { type = 'gift', limit = 50 } = req.query;
    let sortQuery = {};

    switch (type) {
      case 'gift':
        sortQuery = { totalGiftPoints: -1 };
        break;
      case 'traffic':
        sortQuery = { totalTrafficMinutes: -1, activeUsers: -1 };
        break;
      case 'pk':
        sortQuery = { pkPoints: -1, pkWins: -1 };
        break;
      case 'rank':
      default:
        sortQuery = { rankPoints: -1, totalGiftPoints: -1 };
        break;
    }

    const rooms = await Room.find({
      status: { $in: ['active', 'live'] },
      isActive: true
    })
      .populate('ownerId', 'uid name username avatar')
      .sort(sortQuery)
      .limit(parseInt(limit))
      .select('roomId title ownerId roomType totalGiftPoints totalTrafficMinutes pkPoints pkWins pkLosses rankPoints activeUsers cosmetics.backgroundUrl')
      .lean();

    return res.status(200).json({
      success: true,
      rankingType: type,
      rooms
    });
  } catch (error) {
    console.error('Get Room Ranking Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch room ranking.', error: error.message });
  }
};

/**
 * @desc    Send gift to room (adds to loot box & ranking)
 * @route   POST /api/rooms/:roomId/gift
 */
exports.sendGiftToRoom = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId } = req.params;
    const { giftId, giftName, giftPoints, coins } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const points = parseInt(giftPoints) || 1;
    const coinCost = parseInt(coins) || 0;

    // Deduct coins from sender (implement your wallet logic)
    // const sender = await User.findById(userId);
    // if (sender.coins < coinCost) return res.status(400).json({ ... });

    // Add to room's gift points and loot box
    room.totalGiftPoints += points;
    room.lootBoxPoints += Math.floor(points * 0.1); // 10% goes to loot box
    room.rankPoints += Math.floor(points * 0.5); // 50% contributes to rank

    // Level up loot box
    if (room.lootBoxPoints >= room.lootBoxLevel * 100) {
      room.lootBoxLevel += 1;
      room.lootBoxPoints = 0;
    }

    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Gift sent to room!',
      totalGiftPoints: room.totalGiftPoints,
      lootBoxLevel: room.lootBoxLevel,
      lootBoxPoints: room.lootBoxPoints
    });
  } catch (error) {
    console.error('Send Gift To Room Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send gift.', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────────
// SECTION 74: ROOM PK BATTLES
// ────────────────────────────────────────────────────────────────

/**
 * @desc    Challenge another room to PK
 * @route   POST /api/rooms/:roomId/pk/challenge
 */
exports.challengeRoomPK = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId } = req.params;
    const { opponentRoomId } = req.body;

    const challengerRoom = await Room.findOne({ roomId });
    if (!challengerRoom) {
      return res.status(404).json({ success: false, message: 'Challenger room not found.' });
    }

    if (challengerRoom.ownerId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room owner can challenge another room.' });
    }

    const opponentRoom = await Room.findOne({ roomId: opponentRoomId });
    if (!opponentRoom) {
      return res.status(404).json({ success: false, message: 'Opponent room not found.' });
    }

    // Check if either room already has an active PK
    if (challengerRoom.currentPkChallenge && challengerRoom.currentPkChallenge.status === 'active') {
      return res.status(400).json({ success: false, message: 'Your room already has an active PK challenge.' });
    }

    const challengeId = `PK_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const pkChallenge = {
      challengeId,
      challengerRoomId: roomId,
      challengerRoomName: challengerRoom.title,
      opponentRoomId: opponentRoomId,
      opponentRoomName: opponentRoom.title,
      challengerScore: 0,
      opponentScore: 0,
      startTime: new Date(),
      endTime: null,
      status: 'active',
      winnerRoomId: null
    };

    challengerRoom.currentPkChallenge = pkChallenge;
    opponentRoom.currentPkChallenge = pkChallenge;

    await challengerRoom.save();
    await opponentRoom.save();

    return res.status(201).json({
      success: true,
      message: 'PK challenge started!',
      challenge: pkChallenge
    });
  } catch (error) {
    console.error('Challenge PK Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to start PK challenge.', error: error.message });
  }
};

/**
 * @desc    Get room PK status
 * @route   GET /api/rooms/:roomId/pk/status
 */
exports.getPKStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId }).lean();

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    return res.status(200).json({
      success: true,
      currentPkChallenge: room.currentPkChallenge,
      pkStats: {
        wins: room.pkWins,
        losses: room.pkLosses,
        points: room.pkPoints
      }
    });
  } catch (error) {
    console.error('Get PK Status Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get PK status.', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────────
// SECTION 75: ROOM TASKS & DAILY MISSIONS
// ────────────────────────────────────────────────────────────────

/**
 * @desc    Get daily tasks for a room
 * @route   GET /api/rooms/:roomId/tasks
 */
exports.getRoomTasks = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // Check if tasks need regeneration
    const needsRegen = room.dailyTasks.length === 0 ||
      room.dailyTasks.every(t => t.expiresAt && new Date(t.expiresAt) < new Date());

    if (needsRegen) {
      room.dailyTasks = generateDailyTasks();
      await room.save();
    }

    return res.status(200).json({
      success: true,
      tasks: room.dailyTasks
    });
  } catch (error) {
    console.error('Get Room Tasks Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tasks.', error: error.message });
  }
};

/**
 * @desc    Update task progress
 * @route   PUT /api/rooms/:roomId/tasks/:taskId/progress
 */
exports.updateTaskProgress = async (req, res) => {
  try {
    const { roomId, taskId } = req.params;
    const { increment = 1 } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const task = room.dailyTasks.find(t => t.taskId === taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (task.isCompleted) {
      return res.status(400).json({ success: false, message: 'Task already completed.' });
    }

    task.currentValue = Math.min(task.currentValue + parseInt(increment), task.targetValue);

    if (task.currentValue >= task.targetValue) {
      task.isCompleted = true;
      task.completedAt = new Date();
    }

    await room.save();

    return res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    console.error('Update Task Progress Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update task.', error: error.message });
  }
};

/**
 * @desc    Claim task reward
 * @route   POST /api/rooms/:roomId/tasks/:taskId/claim
 */
exports.claimTaskReward = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId, taskId } = req.params;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const task = room.dailyTasks.find(t => t.taskId === taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (!task.isCompleted) {
      return res.status(400).json({ success: false, message: 'Task not yet completed.' });
    }

    // Award coins/XP to user (implement your economy system)
    // const user = await User.findById(userId);
    // user.coins += task.rewardCoins;
    // user.xp += task.rewardXp;
    // await user.save();

    return res.status(200).json({
      success: true,
      message: 'Task reward claimed!',
      rewardedCoins: task.rewardCoins,
      rewardedXp: task.rewardXp
    });
  } catch (error) {
    console.error('Claim Task Reward Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to claim reward.', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────────
// SECTION 76: ROOM MANAGEMENT (OWNER/ADMIN)
// ────────────────────────────────────────────────────────────────

/**
 * @desc    Update room settings
 * @route   PUT /api/rooms/:roomId/settings
 */
exports.updateRoomSettings = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId } = req.params;
    const updates = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (room.ownerId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room owner can update settings.' });
    }

    const allowedUpdates = ['title', 'description', 'coverImage', 'tags', 'language', 'roomCategory', 'announcement', 'pinnedMessage', 'welcomeMessage', 'topic'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        room[field] = updates[field];
      }
    });

    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Room settings updated.',
      room
    });
  } catch (error) {
    console.error('Update Room Settings Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update settings.', error: error.message });
  }
};

/**
 * @desc    Close/delete a room (owner only)
 * @route   DELETE /api/rooms/:roomId
 */
exports.closeRoom = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (room.ownerId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room owner can close this room.' });
    }

    room.status = 'inactive';
    room.isLive = false;
    room.isActive = false;
    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Room closed successfully.'
    });
  } catch (error) {
    console.error('Close Room Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to close room.', error: error.message });
  }
};

/**
 * @desc    Toggle room live status
 * @route   POST /api/rooms/:roomId/toggle-live
 */
exports.toggleLive = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (room.ownerId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room owner can toggle live status.' });
    }

    room.isLive = !room.isLive;
    room.status = room.isLive ? 'live' : 'active';
    await room.save();

    return res.status(200).json({
      success: true,
      message: `Room is now ${room.isLive ? 'LIVE' : 'offline'}.`,
      isLive: room.isLive
    });
  } catch (error) {
    console.error('Toggle Live Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle live status.', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ────────────────────────────────────────────────────────────────

function generateDailyTasks() {
  const tasks = [
    {
      taskId: `TASK_${Date.now()}_1`,
      title: '5 Users in Room for 30 Minutes',
      description: 'Keep at least 5 members in the room for 30 continuous minutes.',
      targetValue: 30,
      currentValue: 0,
      rewardCoins: 50,
      rewardXp: 20,
      isCompleted: false,
      completedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    {
      taskId: `TASK_${Date.now()}_2`,
      title: 'Send 10 Gifts in Room',
      description: 'Encourage members to send 10 gifts within the room.',
      targetValue: 10,
      currentValue: 0,
      rewardCoins: 30,
      rewardXp: 15,
      isCompleted: false,
      completedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    {
      taskId: `TASK_${Date.now()}_3`,
      title: 'Host 3 Speakers on Stage',
      description: 'Invite at least 3 different speakers to the stage today.',
      targetValue: 3,
      currentValue: 0,
      rewardCoins: 40,
      rewardXp: 25,
      isCompleted: false,
      completedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  ];
  return tasks;
}