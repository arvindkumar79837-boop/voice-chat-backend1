const Room = require('../models/Room');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const bcrypt = require('bcryptjs');
const AuditLog = require('../models/AuditLog');

// ─── LOCK ROOM (paid feature) ─────────────────────────────────────

exports.lockRoom = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId } = req.params;
    const { pin, durationHours } = req.body;

    if (!pin || pin.length < 4 || pin.length > 8) {
      return res.status(400).json({ success: false, message: 'PIN must be 4-8 digits' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.ownerId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only room owner can lock' });
    }

    const cost = await SystemSettings.getValue('room_lock_cost') || 50;
    const hours = durationHours || (await SystemSettings.getValue('room_lock_duration_hours') || 6);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if ((user.coins || 0) < cost) {
      return res.status(400).json({ success: false, message: `Insufficient coins. Need ${cost}, have ${user.coins || 0}` });
    }

    // ─── ATOMIC DEDUCTION ───
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: cost } },
      { $inc: { coins: -cost } },
      { new: true }
    );
    if (!updatedUser) return res.status(400).json({ success: false, message: 'Insufficient coins' });

    const pinHash = await bcrypt.hash(pin, 10);
    const expiresAt = new Date(Date.now() + hours * 3600000);

    room.isLocked = true;
    room.lockPinHash = pinHash;
    room.lockExpiresAt = expiresAt;
    room.lockPurchasedBy = user._id;
    await room.save();

    await AuditLog.create({
      action: 'ROOM_LOCKED',
      executorId: user._id,
      reason: `Room locked for ${hours}h (cost: ${cost} coins)`,
      metadata: { roomId: room._id, hours, cost, expiresAt },
    });

    return res.json({
      success: true,
      message: `Room locked for ${hours} hours`,
      data: { isLocked: true, lockExpiresAt: expiresAt, coinsDeducted: cost },
    });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── UNLOCK ATTEMPT (verify PIN) ──────────────────────────────────

exports.unlockAttempt = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { pin } = req.body;

    if (!pin) return res.status(400).json({ success: false, message: 'PIN required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (!room.isLocked) return res.json({ success: true, message: 'Room is not locked' });

    if (room.lockExpiresAt && room.lockExpiresAt < new Date()) {
      room.isLocked = false;
      room.lockPinHash = '';
      room.lockExpiresAt = null;
      await room.save();
      return res.json({ success: true, message: 'Lock has expired' });
    }

    const match = await bcrypt.compare(pin, room.lockPinHash);
    if (!match) return res.status(403).json({ success: false, message: 'Wrong PIN' });

    return res.json({ success: true, message: 'PIN verified — you may join' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── UNLOCK ROOM (owner only) ─────────────────────────────────────

exports.unlockRoom = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.ownerId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only room owner can unlock' });
    }

    room.isLocked = false;
    room.lockPinHash = '';
    room.lockExpiresAt = null;
    await room.save();

    return res.json({ success: true, message: 'Room unlocked' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── ROOM DISCOVERY (country + topic filters) ─────────────────────

exports.discoverRooms = async (req, res) => {
  try {
    const { country, topic, roomType, page = 1, limit = 20 } = req.query;
    const filter = { status: { $in: ['active', 'live'] }, isActive: true };

    if (country) filter.country = country;
    if (topic) filter.topic = topic;
    if (roomType) filter.roomType = roomType;

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [rooms, total] = await Promise.all([
      Room.find(filter)
        .populate('ownerId', 'uid name username avatar arvindId')
        .sort({ isLive: -1, activeUsers: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Room.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        rooms,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};
