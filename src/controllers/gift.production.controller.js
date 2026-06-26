const Gift = require('../models/Gift');
const User = require('../models/User');
const GiftEvent = require('../models/GiftEvent');
const GiftTransaction = require('../models/GiftTransaction');
const Room = require('../models/Room');
const GlobalSetting = require('../models/GlobalSetting');
const Agency = require('../models/Agency');

const getUserId = (req) => {
  return req.user?.id || req.user?.userId || req.user?._id || null;
};

// ════════════════════════════════════════════════════════════════
// SECTION 67: GIFT VARIETIES & ANIMATION TYPES
// ════════════════════════════════════════════════════════════════

/**
 * @desc    Get all available gifts for the store (categorized)
 * @route   GET /api/gifts/store?category=HOT&type=SVGA
 */
exports.getStoreGifts = async (req, res) => {
  try {
    const { category, type, festivalId } = req.query;
    const query = { isAvailable: true, isActive: true };

    if (category) query.category = category.toUpperCase();
    if (type) query.giftType = type.toUpperCase();
    if (festivalId) query.festivalId = festivalId;

    const gifts = await Gift.find(query)
      .sort({ sortOrder: 1, coinPrice: 1 })
      .lean();

    // Group by category for store display
    const categorized = {
      hot: gifts.filter(g => g.category === 'HOT'),
      basic: gifts.filter(g => g.category === 'BASIC'),
      premium: gifts.filter(g => g.category === 'PREMIUM'),
      luxury: gifts.filter(g => g.category === 'LUXURY'),
      vip: gifts.filter(g => g.category === 'VIP'),
      lucky: gifts.filter(g => g.giftType === 'LUCKY'),
      festival: gifts.filter(g => g.category === 'FESTIVAL' || g.festivalId),
    };

    return res.status(200).json({
      success: true,
      gifts,
      categorized,
      totalGifts: gifts.length
    });
  } catch (error) {
    console.error('Get Store Gifts Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch gifts.', error: error.message });
  }
};

/**
 * @desc    Get gifts by type (STATIC, ANIMATED, SVGA, 3D, LUCKY, TREASURE, etc.)
 * @route   GET /api/gifts/type/:giftType
 */
exports.getGiftsByType = async (req, res) => {
  try {
    const { giftType } = req.params;
    const validTypes = ['STATIC', 'ANIMATED', 'SVGA', '3D', 'LUCKY', 'TREASURE', 'VEHICLE', 'CASTLE', 'FRAME', 'AVATAR', 'FESTIVAL', 'COMBO'];

    if (!validTypes.includes(giftType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid gift type.' });
    }

    const gifts = await Gift.find({
      giftType: giftType.toUpperCase(),
      isAvailable: true,
      isActive: true
    }).sort({ coinPrice: 1 }).lean();

    return res.status(200).json({ success: true, gifts });
  } catch (error) {
    console.error('Get Gifts By Type Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch gifts.', error: error.message });
  }
};

/**
 * @desc    Send a gift (supports STATIC, ANIMATED, SVGA, 3D, LUCKY, TREASURE, VEHICLE, CASTLE, FRAME, AVATAR, FESTIVAL, COMBO)
 * @route   POST /api/gifts/send
 */
exports.sendGift = async (req, res) => {
  try {
    const senderId = getUserId(req);
    if (!senderId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { giftId, receiverId, roomId, quantity = 1, comboMultiplier = 1, idempotencyKey } = req.body;

    if (!giftId || !receiverId) {
      return res.status(400).json({ success: false, message: 'giftId and receiverId are required.' });
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await GiftEvent.findOne({ idempotencyKey });
      if (existing) {
        return res.status(200).json({ success: true, message: 'Gift already processed.', event: existing });
      }
    }

    const gift = await Gift.findById(giftId);
    if (!gift || !gift.isAvailable || !gift.isActive) {
      return res.status(404).json({ success: false, message: 'Gift not found or unavailable.' });
    }

    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ success: false, message: 'Sender not found.' });
    }

    // Validate VIP level requirement
    if (gift.requiredVipLevel > 0) {
      const senderVipLevel = sender.vipLevel || 0;
      if (senderVipLevel < gift.requiredVipLevel) {
        return res.status(403).json({
          success: false,
          message: `VIP level ${gift.requiredVipLevel} required to send this gift.`
        });
      }
    }

    const totalQuantity = parseInt(quantity) * parseInt(comboMultiplier);
    const totalCost = gift.coinPrice * totalQuantity;

    // Check sender balance
    if (sender.coins < totalCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient coins. You need ${totalCost} coins but have ${sender.coins}.`
      });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found.' });
    }

    // Get commission settings
    const settings = await GlobalSetting.findOne() || {};
    const commissionRate = (settings.giftCommission || 30) / 100;
    const totalDiamondValue = Math.floor(gift.diamondValue * totalQuantity * (1 - commissionRate));
    let finalReceiverCoins = totalDiamondValue;

    // Agency commission split
    if (receiver.agencyId) {
      const agency = await Agency.findById(receiver.agencyId);
      if (agency) {
        const agencyCommission = Math.floor(totalDiamondValue * 0.10);
        finalReceiverCoins = totalDiamondValue - agencyCommission;
        agency.earnings = (agency.earnings || 0) + agencyCommission;
        agency.totalGifts = (agency.totalGifts || 0) + totalQuantity;
        await agency.save();
      }
    }

    // Process lucky gift - random multiplier
    let luckyMultiplier = 1;
    let luckyWinAmount = 0;
    if (gift.isLucky && gift.luckyMultiplier && gift.luckyMultiplier.length > 0) {
      luckyMultiplier = gift.luckyMultiplier[Math.floor(Math.random() * gift.luckyMultiplier.length)];
      luckyWinAmount = gift.coinPrice * totalQuantity * luckyMultiplier;
      if (luckyMultiplier > 1) {
        sender.coins += luckyWinAmount; // Lucky winnings added back
      }
    }

    // Execute transactions
    sender.coins -= totalCost;
    receiver.coins += finalReceiverCoins;

    await sender.save();
    await receiver.save();

    // Build gift event key
    const eventKey = idempotencyKey || `GFT_${senderId}_${giftId}_${Date.now()}`;

    // Create gift event record
    const giftEvent = await GiftEvent.create({
      eventId: `GFT-${Date.now().toString(36).toUpperCase()}`,
      idempotencyKey: eventKey,
      giftId: gift._id,
      giftName: gift.giftName,
      senderId: sender._id,
      senderUid: sender.uid || sender._id.toString(),
      receiverId: receiver._id,
      receiverUid: receiver.uid || receiver._id.toString(),
      roomId: roomId || null,
      coinCostToSender: gift.coinPrice,
      diamondValueToReceiver: gift.diamondValue,
      quantity: totalQuantity,
      totalCoinsCost: totalCost,
      totalDiamondsEarned: finalReceiverCoins,
      status: 'COMPLETED'
    });

    // Update room gift points if roomId provided
    if (roomId) {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.totalGiftPoints += totalCost;
        room.lootBoxPoints += Math.floor(totalCost * 0.1);
        room.rankPoints += Math.floor(totalCost * 0.5);
        if (room.lootBoxPoints >= room.lootBoxLevel * 100) {
          room.lootBoxLevel += 1;
          room.lootBoxPoints = 0;
        }
        await room.save();
      }
    }

    // Build socket event payload
    const io = req.app.get('io');
    const giftPayload = {
      eventId: giftEvent.eventId,
      giftId: gift._id.toString(),
      giftName: gift.giftName,
      giftType: gift.giftType,
      category: gift.category,
      senderId: sender._id.toString(),
      senderName: sender.name || sender.username || 'User',
      senderAvatar: sender.avatar || '',
      receiverId: receiver._id.toString(),
      receiverName: receiver.name || receiver.username || 'User',
      receiverAvatar: receiver.avatar || '',
      quantity: totalQuantity,
      comboMultiplier: parseInt(comboMultiplier),
      previewImageUrl: gift.previewImageUrl,
      animationUrl: gift.animationUrl,
      svgaUrl: gift.svgaUrl,
      animationJsonUrl: gift.animationJsonUrl,
      comboAnimationUrl: gift.comboEnabled ? gift.comboAnimationUrl : '',
      isLucky: gift.isLucky,
      luckyMultiplier: luckyMultiplier > 1 ? luckyMultiplier : null,
      luckyWinAmount: luckyWinAmount > 0 ? luckyWinAmount : null,
      isTreasure: gift.isTreasure,
      treasurePoolCoins: gift.treasurePoolCoins,
      treasureDurationSeconds: gift.treasureDurationSeconds,
      treasureMaxClaimers: gift.treasureMaxClaimers,
      vehicleModelUrl: gift.vehicleModelUrl,
      castleModelUrl: gift.castleModelUrl,
      displayDurationSeconds: gift.displayDurationSeconds,
      frameId: gift.frameId,
      frameImageUrl: gift.frameImageUrl,
      frameDurationDays: gift.frameDurationDays,
      avatarCustomizationId: gift.avatarCustomizationId,
      festivalId: gift.festivalId,
      festivalName: gift.festivalName,
      isLimitedEdition: gift.isLimitedEdition,
      coinCost: totalCost,
      diamondEarned: finalReceiverCoins,
      timestamp: Date.now()
    };

    // Emit to room if provided, otherwise globally to sender/receiver
    if (roomId) {
      io.to(roomId).emit('live_gift_effect', giftPayload);

      // Combo counter event
      if (gift.comboEnabled && parseInt(comboMultiplier) > 1) {
        io.to(roomId).emit('combo_counter_update', {
          senderId: sender._id.toString(),
          senderName: sender.name || sender.username || 'User',
          comboMultiplier: parseInt(comboMultiplier),
          totalQuantity: totalQuantity,
          giftName: gift.giftName,
          totalCost: totalCost
        });
      }

      // Treasure chest activation
      if (gift.isTreasure && gift.treasurePoolCoins > 0) {
        io.to(roomId).emit('treasure_chest_spawned', {
          giftId: gift._id.toString(),
          giftName: gift.giftName,
          poolCoins: gift.treasurePoolCoins,
          durationSeconds: gift.treasureDurationSeconds,
          maxClaimers: gift.treasureMaxClaimers,
          spawnerId: sender._id.toString(),
          spawnerName: sender.name || sender.username || 'User'
        });
      }

      // Castle/Vehicle spawn
      if (gift.giftType === 'CASTLE' && gift.castleModelUrl) {
        io.to(roomId).emit('castle_spawned', {
          senderName: sender.name || sender.username || 'User',
          castleModelUrl: gift.castleModelUrl,
          displayDurationSeconds: gift.displayDurationSeconds || 10
        });
      }
      if (gift.giftType === 'VEHICLE' && gift.vehicleModelUrl) {
        io.to(roomId).emit('vehicle_spawned', {
          senderName: sender.name || sender.username || 'User',
          vehicleModelUrl: gift.vehicleModelUrl,
          displayDurationSeconds: gift.displayDurationSeconds || 8
        });
      }
    } else {
      io.to(sender._id.toString()).emit('live_gift_effect', giftPayload);
      io.to(receiver._id.toString()).emit('live_gift_effect', giftPayload);
    }

    return res.status(200).json({
      success: true,
      message: gift.isLucky && luckyMultiplier > 1
        ? `Lucky win! You got ${luckyMultiplier}x multiplier and won ${luckyWinAmount} coins!`
        : `Gift sent successfully!`,
      balance: sender.coins,
      luckyMultiplier: luckyMultiplier > 1 ? luckyMultiplier : null,
      luckyWinAmount: luckyWinAmount > 0 ? luckyWinAmount : null,
      event: giftEvent
    });
  } catch (error) {
    console.error('Send Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send gift.', error: error.message });
  }
};

/**
 * @desc    Combo gift send (5x, 10x, 99x, 999x burst)
 * @route   POST /api/gifts/combo
 */
exports.sendComboGift = async (req, res) => {
  try {
    const senderId = getUserId(req);
    const { giftId, receiverId, roomId, comboMultiplier = 5 } = req.body;

    if (![5, 10, 99, 999].includes(parseInt(comboMultiplier))) {
      return res.status(400).json({ success: false, message: 'Combo multiplier must be 5, 10, 99, or 999.' });
    }

    // Add combo flag to the request
    req.body.comboMultiplier = comboMultiplier;
    req.body.quantity = 1;

    return exports.sendGift(req, res);
  } catch (error) {
    console.error('Send Combo Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send combo gift.', error: error.message });
  }
};

/**
 * @desc    Claim treasure chest coins
 * @route   POST /api/gifts/treasure/claim
 */
exports.claimTreasure = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { giftEventId } = req.body;

    if (!giftEventId) {
      return res.status(400).json({ success: false, message: 'Gift event ID required.' });
    }

    const giftEvent = await GiftEvent.findOne({ eventId: giftEventId }).populate('giftId');
    if (!giftEvent) {
      return res.status(404).json({ success: false, message: 'Treasure event not found.' });
    }

    const gift = giftEvent.giftId;
    if (!gift || !gift.isTreasure) {
      return res.status(400).json({ success: false, message: 'This is not a treasure gift event.' });
    }

    // Random claim amount from pool
    const claimAmount = Math.floor(Math.random() * Math.min(gift.treasurePoolCoins, 500)) + 10;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.coins += claimAmount;
    await user.save();

    return res.status(200).json({
      success: true,
      claimedCoins: claimAmount,
      balance: user.coins
    });
  } catch (error) {
    console.error('Claim Treasure Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to claim treasure.', error: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
// SECTION 68: GIFT STORE, INVENTORY & COLLECTION
// ════════════════════════════════════════════════════════════════

/**
 * @desc    Get user's gift inventory (gifts they own to send later)
 * @route   GET /api/gifts/inventory
 */
exports.getGiftInventory = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Aggregate gift events where user is the sender, group by gift
    const inventory = await GiftEvent.aggregate([
      { $match: { senderId: userId, status: 'COMPLETED' } },
      { $group: { _id: '$giftId', giftName: { $first: '$giftName' }, totalQuantity: { $sum: '$quantity' }, totalSpent: { $sum: '$totalCoinsCost' } } },
      { $sort: { totalSpent: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      inventory
    });
  } catch (error) {
    console.error('Get Gift Inventory Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory.', error: error.message });
  }
};

/**
 * @desc    Get user's gift collection (unique gifts they've sent/received)
 * @route   GET /api/gifts/collection
 */
exports.getGiftCollection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const collection = await GiftEvent.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
          status: 'COMPLETED'
        }
      },
      { $group: { _id: '$giftId', giftName: { $first: '$giftName' }, timesSent: { $sum: 1 }, uniqueReceivers: { $addToSet: '$receiverId' } } },
      { $sort: { timesSent: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      collection: collection.map(c => ({
        giftId: c._id,
        giftName: c.giftName,
        timesUsed: c.timesSent,
        uniqueReceiversCount: c.uniqueReceivers.length
      })),
      uniqueGiftsCount: collection.length
    });
  } catch (error) {
    console.error('Get Gift Collection Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch collection.', error: error.message });
  }
};

/**
 * @desc    Set/update room gift goal
 * @route   POST /api/gifts/goals
 */
exports.setGiftGoal = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { roomId, targetCoins, title } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (room.ownerId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only room owner can set gift goals.' });
    }

    // Store goal in room (you can extend Room schema or use a separate collection)
    room.announcement = `🎯 GOAL: ${title || 'Collect ' + targetCoins + ' coins'} - Target: ${targetCoins} coins`;
    await room.save();

    const io = req.app.get('io');
    io.to(roomId).emit('gift_goal_updated', {
      targetCoins: parseInt(targetCoins),
      currentCoins: room.totalGiftPoints || 0,
      title: title || 'Room Gift Goal',
      progressPercent: room.totalGiftPoints > 0 ? Math.min((room.totalGiftPoints / parseInt(targetCoins)) * 100, 100) : 0
    });

    return res.status(200).json({
      success: true,
      message: 'Gift goal set successfully.',
      goal: { targetCoins, currentCoins: room.totalGiftPoints || 0, title }
    });
  } catch (error) {
    console.error('Set Gift Goal Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to set gift goal.', error: error.message });
  }
};

/**
 * @desc    Get gift ranking/leaderboard
 * @route   GET /api/gifts/leaderboard?type=sender&limit=50
 */
exports.getGiftLeaderboard = async (req, res) => {
  try {
    const { type = 'sender', limit = 50 } = req.query;

    let groupField, sortField;
    if (type === 'sender') {
      groupField = '$senderId';
      sortField = 'totalSpent';
    } else {
      groupField = '$receiverId';
      sortField = 'totalEarned';
    }

    const leaderboard = await GiftEvent.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: groupField,
          totalQuantity: { $sum: '$quantity' },
          totalSpent: { $sum: '$totalCoinsCost' },
          totalEarned: { $sum: '$totalDiamondsEarned' },
          uniqueGifts: { $addToSet: '$giftId' },
          lastGiftAt: { $max: '$createdAt' }
        }
      },
      { $sort: { [sortField]: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Populate user details
    const userIds = leaderboard.map(u => u._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select('name username avatar')
      .lean();

    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const enriched = leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry._id,
      userName: userMap[entry._id?.toString()]?.name || userMap[entry._id?.toString()]?.username || 'Unknown',
      userAvatar: userMap[entry._id?.toString()]?.avatar || '',
      totalQuantity: entry.totalQuantity,
      totalSpent: entry.totalSpent,
      totalEarned: entry.totalEarned,
      uniqueGiftsCount: entry.uniqueGifts.length,
      lastGiftAt: entry.lastGiftAt
    }));

    return res.status(200).json({
      success: true,
      leaderboardType: type,
      leaderboard: enriched
    });
  } catch (error) {
    console.error('Get Gift Leaderboard Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch leaderboard.', error: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
// SECTION 69: GIFT STATISTICS & HISTORY
// ════════════════════════════════════════════════════════════════

/**
 * @desc    Get gift statistics for a user
 * @route   GET /api/gifts/statistics
 */
exports.getGiftStatistics = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const stats = await GiftEvent.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
          status: 'COMPLETED'
        }
      },
      {
        $group: {
          _id: null,
          totalSent: { $sum: { $cond: [{ $eq: ['$senderId', userId] }, '$quantity', 0] } },
          totalReceived: { $sum: { $cond: [{ $eq: ['$receiverId', userId] }, '$quantity', 0] } },
          totalSpent: { $sum: { $cond: [{ $eq: ['$senderId', userId] }, '$totalCoinsCost', 0] } },
          totalEarned: { $sum: { $cond: [{ $eq: ['$receiverId', userId] }, '$totalDiamondsEarned', 0] } },
          uniqueGiftsSent: { $addToSet: { $cond: [{ $eq: ['$senderId', userId] }, '$giftId', null] } },
          uniqueGiftsReceived: { $addToSet: { $cond: [{ $eq: ['$receiverId', userId] }, '$giftId', null] } }
        }
      }
    ]);

    const result = stats[0] || { totalSent: 0, totalReceived: 0, totalSpent: 0, totalEarned: 0 };

    return res.status(200).json({
      success: true,
      statistics: {
        totalGiftsSent: result.totalSent || 0,
        totalGiftsReceived: result.totalReceived || 0,
        totalCoinsSpent: result.totalSpent || 0,
        totalDiamondsEarned: result.totalEarned || 0,
        uniqueGiftsSentCount: (result.uniqueGiftsSent || []).filter(Boolean).length,
        uniqueGiftsReceivedCount: (result.uniqueGiftsReceived || []).filter(Boolean).length
      }
    });
  } catch (error) {
    console.error('Get Gift Statistics Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch statistics.', error: error.message });
  }
};

/**
 * @desc    Get recent gift history
 * @route   GET /api/gifts/history?limit=50&page=1
 */
exports.getGiftHistory = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const history = await GiftEvent.find({ status: 'COMPLETED' })
      .populate('senderId', 'name username avatar')
      .populate('receiverId', 'name username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await GiftEvent.countDocuments({ status: 'COMPLETED' });

    return res.status(200).json({
      success: true,
      history: history.map(h => ({
        eventId: h.eventId,
        giftName: h.giftName,
        quantity: h.quantity,
        totalCoinsCost: h.totalCoinsCost,
        totalDiamondsEarned: h.totalDiamondsEarned,
        senderName: h.senderId?.name || h.senderId?.username || 'Unknown',
        senderAvatar: h.senderId?.avatar || '',
        receiverName: h.receiverId?.name || h.receiverId?.username || 'Unknown',
        receiverAvatar: h.receiverId?.avatar || '',
        createdAt: h.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get Gift History Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch history.', error: error.message });
  }
};

/**
 * @desc    Create a festival/event gift (admin)
 * @route   POST /api/gifts/festival
 */
exports.createFestivalGift = async (req, res) => {
  try {
    const {
      giftName, description, coinPrice, diamondValue, giftType = 'FESTIVAL',
      category = 'FESTIVAL', animationUrl, svgaUrl, previewImageUrl,
      festivalId, festivalName, isLimitedEdition, expiresAt
    } = req.body;

    if (!giftName || !coinPrice) {
      return res.status(400).json({ success: false, message: 'Gift name and price are required.' });
    }

    const gift = await Gift.create({
      giftName, description, coinPrice, diamondValue: diamondValue || Math.floor(coinPrice * 0.7),
      giftType: giftType.toUpperCase(), category: category.toUpperCase(),
      animationUrl: animationUrl || '', svgaUrl: svgaUrl || '',
      previewImageUrl: previewImageUrl || '',
      festivalId: festivalId || '', festivalName: festivalName || '',
      isLimitedEdition: isLimitedEdition || false,
      expiresAt: expiresAt || null,
      isAvailable: true, isActive: true
    });

    return res.status(201).json({
      success: true,
      message: 'Festival gift created.',
      gift
    });
  } catch (error) {
    console.error('Create Festival Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create festival gift.', error: error.message });
  }
};

/**
 * @desc    Update gift availability (admin toggle)
 * @route   PUT /api/gifts/:giftId/toggle
 */
exports.toggleGiftAvailability = async (req, res) => {
  try {
    const { giftId } = req.params;
    const gift = await Gift.findById(giftId);
    if (!gift) {
      return res.status(404).json({ success: false, message: 'Gift not found.' });
    }

    gift.isAvailable = !gift.isAvailable;
    await gift.save();

    return res.status(200).json({
      success: true,
      message: `Gift ${gift.isAvailable ? 'enabled' : 'disabled'} successfully.`,
      isAvailable: gift.isAvailable
    });
  } catch (error) {
    console.error('Toggle Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle gift.', error: error.message });
  }
};

/**
 * @desc    Admin create/edit any gift
 * @route   POST /api/gifts/admin/create
 */
exports.adminCreateGift = async (req, res) => {
  try {
    const giftData = req.body;
    const gift = await Gift.create(giftData);
    return res.status(201).json({ success: true, message: 'Gift created.', gift });
  } catch (error) {
    console.error('Admin Create Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create gift.', error: error.message });
  }
};

/**
 * @desc    Admin update gift
 * @route   PUT /api/gifts/admin/:giftId
 */
exports.adminUpdateGift = async (req, res) => {
  try {
    const { giftId } = req.params;
    const updates = req.body;

    const gift = await Gift.findByIdAndUpdate(giftId, updates, { new: true });
    if (!gift) {
      return res.status(404).json({ success: false, message: 'Gift not found.' });
    }

    return res.status(200).json({ success: true, message: 'Gift updated.', gift });
  } catch (error) {
    console.error('Admin Update Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update gift.', error: error.message });
  }
};

/**
 * @desc    Delete a gift (admin)
 * @route   DELETE /api/gifts/admin/:giftId
 */
exports.adminDeleteGift = async (req, res) => {
  try {
    const { giftId } = req.params;
    await Gift.findByIdAndDelete(giftId);
    return res.status(200).json({ success: true, message: 'Gift deleted.' });
  } catch (error) {
    console.error('Admin Delete Gift Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete gift.', error: error.message });
  }
};