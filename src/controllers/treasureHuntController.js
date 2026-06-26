const TreasureHunt = require('../models/TreasureHunt');
const Event = require('../models/Event');
const User = require('../models/User');

// ─── TREASURE HUNT CRUD ────────────────────────────────────────────────

exports.createTreasureHunt = async (req, res) => {
  try {
    const payload = req.body;
    const ownerId = req.user.userId;

    if (!payload.hunt_name || !payload.event_id || !payload.room_id || !payload.start_time || !payload.end_time) {
      return res.status(400).json({ success: false, message: 'Missing required treasure hunt fields' });
    }

    const event = await Event.findById(payload.event_id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const treasureHunt = await TreasureHunt.create({
      ...payload,
      owner_id: ownerId
    });

    res.status(201).json({ success: true, message: 'Treasure hunt created successfully', data: treasureHunt });
  } catch (error) {
    console.error('Create Treasure Hunt Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create treasure hunt' });
  }
};

exports.getTreasureHunts = async (req, res) => {
  try {
    const { page = 1, limit = 20, event_id, room_id, is_active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (event_id) query.event_id = event_id;
    if (room_id) query.room_id = room_id;
    if (is_active !== undefined) query.is_active = is_active === 'true';

    const treasureHunts = await TreasureHunt.find(query)
      .populate('owner_id', 'name avatar uid')
      .populate('event_id', 'event_name')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TreasureHunt.countDocuments(query);

    res.status(200).json({
      success: true,
      data: treasureHunts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get Treasure Hunts Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch treasure hunts' });
  }
};

exports.getTreasureHuntById = async (req, res) => {
  try {
    const { huntId } = req.params;
    const treasureHunt = await TreasureHunt.findById(huntId)
      .populate('owner_id', 'name avatar uid')
      .populate('event_id', 'event_name')
      .populate('found_by', 'name avatar uid');

    if (!treasureHunt) {
      return res.status(404).json({ success: false, message: 'Treasure hunt not found' });
    }

    res.status(200).json({ success: true, data: treasureHunt });
  } catch (error) {
    console.error('Get Treasure Hunt Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch treasure hunt' });
  }
};

exports.collectTreasureKey = async (req, res) => {
  try {
    const { huntId } = req.params;
    const userId = req.user.userId;

    const treasureHunt = await TreasureHunt.findById(huntId);
    if (!treasureHunt || !treasureHunt.is_active) {
      return res.status(404).json({ success: false, message: 'Treasure hunt not found or inactive' });
    }

    if (treasureHunt.is_found) {
      return res.status(400).json({ success: false, message: 'Treasure has already been found' });
    }

    if (treasureHunt.keys_collected_count >= treasureHunt.keys_required) {
      return res.status(400).json({ success: false, message: 'All keys already collected' });
    }

    if (treasureHunt.keys_collected.some(k => k.toString() === userId.toString())) {
      return res.status(400).json({ success: false, message: 'You have already collected a key' });
    }

    treasureHunt.keys_collected.push(userId);
    treasureHunt.keys_collected_count = treasureHunt.keys_collected.length;

    if (treasureHunt.keys_collected_count >= treasureHunt.keys_required) {
      treasureHunt.is_found = true;
      treasureHunt.found_by = userId;
      treasureHunt.found_at = new Date();

      await distributeTreasureRewards(treasureHunt);
    }

    await treasureHunt.save();

    res.status(200).json({
      success: true,
      message: treasureHunt.is_found ? 'Treasure found! Rewards distributed' : 'Key collected successfully',
      data: {
        keysCollected: treasureHunt.keys_collected_count,
        keysRequired: treasureHunt.keys_required,
        isFound: treasureHunt.is_found
      }
    });
  } catch (error) {
    console.error('Collect Treasure Key Error:', error);
    res.status(500).json({ success: false, message: 'Failed to collect key' });
  }
};

async function distributeTreasureRewards(treasureHunt) {
  const rewards = treasureHunt.rewards;
  const finders = treasureHunt.keys_collected;

  for (const finderId of finders) {
    const user = await User.findById(finderId);
    if (!user) continue;

    user.coins = (user.coins || 0) + (rewards.coins || 0);
    user.diamonds = (user.diamonds || 0) + (rewards.diamonds || 0);
    user.xp = (user.xp || 0) + (rewards.xp || 0);

    if (rewards.frames && rewards.frames.length > 0) {
      user.unlockedFrames = user.unlockedFrames || [];
      for (const frame of rewards.frames) {
        if (!user.unlockedFrames.includes(frame)) {
          user.unlockedFrames.push(frame);
        }
      }
    }

    if (rewards.badges && rewards.badges.length > 0) {
      user.unlockedBadges = user.unlockedBadges || [];
      for (const badge of rewards.badges) {
        if (!user.unlockedBadges.includes(badge)) {
          user.unlockedBadges.push(badge);
        }
      }
    }

    if (rewards.cars && rewards.cars.length > 0) {
      user.unlockedFrames = user.unlockedFrames || [];
      for (const car of rewards.cars) {
        if (!user.unlockedFrames.includes(car)) {
          user.unlockedFrames.push(car);
        }
      }
    }

    await user.save();
  }
}

exports.getActiveTreasureHunt = async (req, res) => {
  try {
    const { roomId } = req.query;
    const userId = req.user.userId;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Room ID is required' });
    }

    const now = new Date();
    const treasureHunt = await TreasureHunt.findOne({
      room_id: roomId,
      is_active: true,
      is_found: false,
      start_time: { $lte: now },
      end_time: { $gte: now }
    }).populate('owner_id', 'name avatar uid');

    if (!treasureHunt) {
      return res.status(404).json({ success: false, message: 'No active treasure hunt in this room' });
    }

    const hasKey = treasureHunt.keys_collected.some(k => k.toString() === userId.toString());

    res.status(200).json({
      success: true,
      data: {
        ...treasureHunt.toObject(),
        hasKey,
        keysCollected: treasureHunt.keys_collected_count,
        keysRequired: treasureHunt.keys_required
      }
    });
  } catch (error) {
    console.error('Get Active Treasure Hunt Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch treasure hunt' });
  }
};

exports.adminGetAllTreasureHunts = async (req, res) => {
  try {
    const treasureHunts = await TreasureHunt.find()
      .populate('owner_id', 'name avatar uid')
      .populate('event_id', 'event_name')
      .populate('found_by', 'name avatar uid')
      .sort({ created_at: -1 });

    res.status(200).json({ success: true, data: treasureHunts });
  } catch (error) {
    console.error('Admin Get Treasure Hunts Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch treasure hunts' });
  }
};