// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER: TargetManagerController — Streamer targets & 50-50 revenue split
// Weekly, 15-Day, Monthly cycles with diamond-to-coin exchange enforcement
// ═══════════════════════════════════════════════════════════════════════════

const TargetManager = require('../models/TargetManager');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const AuditLog = require('../models/AuditLog');

/**
 * POST /api/targets/create
 * Create a new target cycle for a streamer
 */
exports.createTarget = async (req, res) => {
  try {
    const { streamerUid, cycleType, targetDiamonds, targetCoins, targetGiftCount, targetLiveHours } = req.body;

    if (!streamerUid || !cycleType || !targetDiamonds) {
      return res.status(400).json({ success: false, message: 'Streamer UID, cycle type, and target diamonds required' });
    }

    const streamer = await User.findOne({ uid: streamerUid });
    if (!streamer) {
      return res.status(404).json({ success: false, message: 'Streamer not found' });
    }

    // Define cycle dates
    const now = new Date();
    let startDate, endDate;
    switch (cycleType) {
      case 'weekly':
        startDate = new Date(now);
        endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'fifteen_day':
        startDate = new Date(now);
        endDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid cycle type' });
    }

    const target = await TargetManager.create({
      streamerId: streamer._id,
      streamerUid,
      cycle: { cycleType, startDate, endDate, targetDiamonds, targetCoins, targetGiftCount, targetLiveHours },
    });

    return res.status(201).json({ success: true, message: 'Target created successfully', data: target });
  } catch (error) {
    console.error('createTarget Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/targets/progress/:id
 * Update streamer's progress toward target
 */
exports.updateProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { diamonds, coins, giftCount, liveHours } = req.body;

    const target = await TargetManager.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }

    if (diamonds !== undefined) target.progress.currentDiamonds += diamonds;
    if (coins !== undefined) target.progress.currentCoins += coins;
    if (giftCount !== undefined) target.progress.currentGiftCount += giftCount;
    if (liveHours !== undefined) target.progress.currentLiveHours += liveHours;

    await target.save(); // Triggers pre-save for percentComplete and isTargetMet

    return res.status(200).json({ success: true, message: 'Progress updated', data: target });
  } catch (error) {
    console.error('updateProgress Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/targets/exchange/:id
 * Streamer initiates diamond-to-coin exchange after target met
 * Enforces 50-50 revenue split on the backend ledger
 */
exports.requestDiamondExchange = async (req, res) => {
  try {
    const { id } = req.params;
    const { diamondAmount } = req.body;

    if (!diamondAmount || diamondAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid diamond amount required' });
    }

    const target = await TargetManager.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }

    if (!target.isTargetMet) {
      return res.status(400).json({ success: false, message: 'Target not yet met. Current progress: ' + target.progress.percentComplete + '%' });
    }

    if (target.settlement.isSettled) {
      return res.status(400).json({ success: false, message: 'This target cycle has already been settled' });
    }

    // Enforce 50-50 split ratio
    const splitRatio = target.settlement.splitRatio || 50;
    const platformShare = Math.floor(diamondAmount * (splitRatio / 100));
    const streamerShare = diamondAmount - platformShare;

    // Convert streamer's share to coins (exchange rate: 1 diamond = 1 coin)
    const coinAmount = streamerShare;

    // Create exchange request
    target.diamondExchangeRequests.push({
      diamondAmount,
      coinAmount,
      status: 'pending',
    });

    // Update settlement pre-computation
    target.settlement.totalRevenue += diamondAmount;
    target.settlement.platformShare += platformShare;
    target.settlement.streamerShare += streamerShare;

    await target.save();

    return res.status(200).json({
      success: true,
      message: `Exchange request submitted. Splitting ${diamondAmount} diamonds: Platform gets ${platformShare}, Streamer gets ${streamerShare} coins`,
      data: {
        diamondAmount,
        platformShare,
        streamerShare,
        coinAmount,
        splitRatio,
        exchangeRequests: target.diamondExchangeRequests,
      },
    });
  } catch (error) {
    console.error('requestDiamondExchange Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/targets/approve-exchange/:targetId/:requestIndex
 * Admin/Owner approves the diamond exchange and processes the settlement
 */
exports.approveExchange = async (req, res) => {
  try {
    const { targetId, requestIndex } = req.params;

    const target = await TargetManager.findById(targetId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }

    const reqIdx = parseInt(requestIndex);
    if (reqIdx < 0 || reqIdx >= target.diamondExchangeRequests.length) {
      return res.status(400).json({ success: false, message: 'Invalid exchange request index' });
    }

    const exchangeReq = target.diamondExchangeRequests[reqIdx];
    if (exchangeReq.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Exchange already processed' });
    }

    // Process: credit streamer with coins
    const streamer = await User.findById(target.streamerId);
    if (!streamer) {
      return res.status(404).json({ success: false, message: 'Streamer user not found' });
    }

    streamer.coins = (streamer.coins || 0) + exchangeReq.coinAmount;
    await streamer.save();

    // Record wallet transaction
    await WalletTransaction.create({
      userId: streamer._id,
      type: 'settlement',
      amount: exchangeReq.coinAmount,
      amountInr: 0,
      description: `Target diamond exchange: ${exchangeReq.diamondAmount} diamonds → ${exchangeReq.coinAmount} coins (50-50 split)`,
      status: 'completed',
      metadata: {
        targetId: target._id.toString(),
        diamondAmount: exchangeReq.diamondAmount,
        platformShare: target.settlement.platformShare,
        streamerShare: target.settlement.streamerShare,
      },
    });

    // Mark exchange as approved and settlement as settled
    exchangeReq.status = 'approved';
    exchangeReq.processedAt = new Date();
    exchangeReq.processedBy = req.user?.userId || 'ADMIN';
    target.settlement.isSettled = true;
    target.settlement.settledAt = new Date();
    await target.save();

    // Audit log
    await AuditLog.create({
      action: 'TARGET_EXCHANGE_APPROVED',
      performedBy: req.user?.userId || 'ADMIN',
      details: `Approved exchange for streamer ${target.streamerUid}: ${exchangeReq.diamondAmount} diamonds → ${exchangeReq.coinAmount} coins`,
      metadata: {
        targetId: target._id.toString(),
        streamerUid: target.streamerUid,
        diamondAmount: exchangeReq.diamondAmount,
        coinAmount: exchangeReq.coinAmount,
        platformShare: target.settlement.platformShare,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Exchange approved. ${exchangeReq.coinAmount} coins credited to ${target.streamerUid}`,
      data: target,
    });
  } catch (error) {
    console.error('approveExchange Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/targets
 * List all targets with filtering and pagination
 */
exports.getTargets = async (req, res) => {
  try {
    const { streamerUid, cycleType, isTargetMet, isSettled, page, limit } = req.query;
    const query = {};

    if (streamerUid) query.streamerUid = streamerUid;
    if (cycleType) query['cycle.cycleType'] = cycleType;
    if (isTargetMet !== undefined) query.isTargetMet = isTargetMet === 'true';
    if (isSettled !== undefined) query['settlement.isSettled'] = isSettled === 'true';

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;

    const [targets, total] = await Promise.all([
      TargetManager.find(query)
        .populate('streamerId', 'uid name username avatar level')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      TargetManager.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: targets,
      pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error('getTargets Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/targets/:id
 * Get single target with full details
 */
exports.getTargetDetail = async (req, res) => {
  try {
    const target = await TargetManager.findById(req.params.id)
      .populate('streamerId', 'uid name username avatar level coins diamonds')
      .lean();

    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }

    return res.status(200).json({ success: true, data: target });
  } catch (error) {
    console.error('getTargetDetail Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/targets/auto-cycle
 * Admin: Auto-create target cycles for all streamers (weekly, 15-day, monthly)
 */
exports.autoCreateCycles = async (req, res) => {
  try {
    const { cycleType, targetDiamonds } = req.body;
    if (!cycleType || !targetDiamonds) {
      return res.status(400).json({ success: false, message: 'Cycle type and target diamonds required' });
    }

    const streamers = await User.find({ role: 'streamer', isActive: true }).select('uid _id');
    const now = new Date();
    let startDate, endDate;

    switch (cycleType) {
      case 'weekly':
        startDate = new Date(now);
        endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'fifteen_day':
        startDate = new Date(now);
        endDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid cycle type' });
    }

    const targets = [];
    for (const streamer of streamers) {
      targets.push({
        streamerId: streamer._id,
        streamerUid: streamer.uid,
        cycle: { cycleType, startDate, endDate, targetDiamonds },
      });
    }

    if (targets.length > 0) {
      await TargetManager.insertMany(targets);
    }

    return res.status(201).json({
      success: true,
      message: `Auto-created ${targets.length} target cycles for ${cycleType}`,
      data: { count: targets.length, cycleType },
    });
  } catch (error) {
    console.error('autoCreateCycles Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};