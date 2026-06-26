const mongoose = require('mongoose');
const WebViewGame = require('../models/WebViewGame');
const GameRecord = require('../models/GameRecord');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

exports.getAllGames = async (req, res) => {
  try {
    const { gameType, isActive, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (gameType) filter.gameType = gameType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const games = await WebViewGame.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('createdBy', 'name uid');

    const total = await WebViewGame.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: games,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Fetch Games Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getActiveGames = async (req, res) => {
  try {
    const games = await WebViewGame.find({ isActive: true }).select('-createdBy').sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: games });
  } catch (error) {
    console.error('Fetch Active Games Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getGameById = async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await WebViewGame.findById(gameId).populate('createdBy', 'name uid');
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    return res.status(200).json({ success: true, data: game });
  } catch (error) {
    console.error('Fetch Game Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.createGame = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description, gameType, gameUrl, thumbnailUrl, minBetAmount, maxBetAmount, houseEdgePercentage, rewardType, coinToDiamondRatio, diamondToCoinRatio, tags, configuration } = req.body;

    if (!name || !gameType || !gameUrl) {
      return res.status(400).json({ success: false, message: 'Name, gameType, and gameUrl are required' });
    }

    const validGameTypes = ['RENTED', 'IN_HOUSE', 'WEB_BASED'];
    if (!validGameTypes.includes(gameType)) {
      return res.status(400).json({ success: false, message: 'Invalid gameType. Must be RENTED, IN_HOUSE, or WEB_BASED' });
    }

    const validRewardTypes = ['COINS', 'DIAMONDS', 'BOTH'];
    if (rewardType && !validRewardTypes.includes(rewardType)) {
      return res.status(400).json({ success: false, message: 'Invalid rewardType' });
    }

    const game = await WebViewGame.create({
      name,
      description: description || '',
      gameType,
      gameUrl,
      thumbnailUrl: thumbnailUrl || '',
      minBetAmount: minBetAmount || 10,
      maxBetAmount: maxBetAmount || 10000,
      houseEdgePercentage: houseEdgePercentage || 5,
      rewardType: rewardType || 'COINS',
      coinToDiamondRatio: coinToDiamondRatio || 100,
      diamondToCoinRatio: diamondToCoinRatio || 0.01,
      createdBy: userId,
      tags: tags || [],
      configuration: configuration || {}
    });

    return res.status(201).json({ success: true, message: 'Game created successfully', data: game });
  } catch (error) {
    console.error('Create Game Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updateGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const updates = req.body;

    const game = await WebViewGame.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    if (updates.gameType && !['RENTED', 'IN_HOUSE', 'WEB_BASED'].includes(updates.gameType)) {
      return res.status(400).json({ success: false, message: 'Invalid gameType' });
   }

    if (updates.rewardType && !['COINS', 'DIAMONDS', 'BOTH'].includes(updates.rewardType)) {
      return res.status(400).json({ success: false, message: 'Invalid rewardType' });
    }

    Object.assign(game, updates);
    await game.save();

    return res.status(200).json({ success: true, message: 'Game updated successfully', data: game });
  } catch (error) {
    console.error('Update Game Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.deleteGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await WebViewGame.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    game.isActive = false;
    await game.save();

    return res.status(200).json({ success: true, message: 'Game deactivated successfully' });
  } catch (error) {
    console.error('Delete Game Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.startGameSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { gameId, betAmount } = req.body;

    if (!gameId || !betAmount || betAmount <= 0) {
      return res.status(400).json({ success: false, message: 'gameId and valid betAmount are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const game = await WebViewGame.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (!game.isActive) return res.status(400).json({ success: false, message: 'Game is not active' });

    if (betAmount < game.minBetAmount || betAmount > game.maxBetAmount) {
      return res.status(400).json({ success: false, message: `Bet amount must be between ${game.minBetAmount} and ${game.maxBetAmount}` });
    }

    const currentCoins = user.coins || 0;
    if (currentCoins < betAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient coins', balance: { coins: currentCoins } });
    }

    user.coins -= betAmount;
    await user.save();

    const gameSession = await GameRecord.create({
      user: userId,
      gameType: `WEBVIEW_${game.gameType}`,
      betAmount: betAmount,
      winAmount: 0,
      rewardType: game.rewardType,
      gameId: gameId
    });

    game.totalPlays += 1;
    game.totalVolume += betAmount;
    await game.save();

    return res.status(200).json({
      success: true,
      message: 'Game session started',
      sessionId: gameSession._id,
      gameUrl: game.gameUrl,
      balance: { coins: user.coins, diamonds: user.diamonds || 0 },
      configuration: game.configuration,
      rewardType: game.rewardType,
      coinToDiamondRatio: game.coinToDiamondRatio,
      diamondToCoinRatio: game.diamondToCoinRatio
    });
  } catch (error) {
    console.error('Start Game Session Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.endGameSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId, winAmount } = req.body;

    if (!sessionId || !winAmount || winAmount < 0) {
      return res.status(400).json({ success: false, message: 'sessionId and winAmount are required' });
    }

    const gameSession = await GameRecord.findById(sessionId);
    if (!gameSession) return res.status(404).json({ success: false, message: 'Game session not found' });
    if (gameSession.user.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (gameSession.winAmount > 0) {
      return res.status(400).json({ success: false, message: 'Session already ended' });
    }

    const user = await User.findById(userId);
    const game = await WebViewGame.findById(gameSession.gameId);

    if (!user || !game) {
      return res.status(404).json({ success: false, message: 'User or Game not found' });
    }

    gameSession.winAmount = winAmount;
    gameSession.rewardType = game.rewardType;

    if (winAmount > 0) {
      if (game.rewardType === 'COINS' || game.rewardType === 'BOTH') {
        user.coins += winAmount;
      }
      if (game.rewardType === 'DIAMONDS' || game.rewardType === 'BOTH') {
        const diamondAmount = game.rewardType === 'BOTH'
          ? Math.floor(winAmount / game.coinToDiamondRatio)
          : winAmount;
        user.diamonds = (user.diamonds || 0) + diamondAmount;
      }
      game.totalWinnings += winAmount;
    }

    await user.save();
    await gameSession.save();
    await game.save();

    return res.status(200).json({
      success: true,
      message: 'Game session ended',
      balance: { coins: user.coins, diamonds: user.diamonds || 0 },
      won: winAmount > 0,
      winAmount
    });
  } catch (error) {
    console.error('End Game Session Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getGameLedger = async (req, res) => {
  try {
    const adminUserId = req.user.userId;
    const user = await User.findById(adminUserId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { gameId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (gameId) filter.gameId = gameId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sessions = await GameRecord.find(filter)
      .populate('user', 'name uid avatar')
      .populate('gameId', 'name gameType')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalVolumeResult = await GameRecord.aggregate([
      { $match: filter },
      { $group: { _id: null, totalVolume: { $sum: '$betAmount' }, totalWinnings: { $sum: '$winAmount' }, totalSessions: { $sum: 1 } } }
    ]);

    const totalVolume = totalVolumeResult.length > 0 ? totalVolumeResult[0] : { totalVolume: 0, totalWinnings: 0, totalSessions: 0 };
    const netProfit = totalVolume.totalVolume - totalVolume.totalWinnings;

    return res.status(200).json({
      success: true,
      data: sessions,
      summary: { totalVolume: totalVolume.totalVolume, totalWinnings: totalVolume.totalWinnings, netProfit, totalSessions: totalVolume.totalSessions }
    });
  } catch (error) {
    console.error('Get Game Ledger Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getGameLeaderboard = async (req, res) => {
  try {
    const { period = 'weekly', gameId, limit = 50 } = req.query;

    let dateFilter = {};
    const now = new Date();
    if (period === 'daily') {
      dateFilter.$gte = new Date(now.setHours(0, 0, 0, 0));
    } else if (period === 'weekly') {
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'monthly') {
      dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
    }

    const matchFilter = {
      createdAt: dateFilter,
      winAmount: { $gt: 0 },
      gameType: { $regex: /^WEBVIEW_/ }
    };
    if (gameId) matchFilter.gameId = mongoose.Types.ObjectId(gameId);

    const leaderboard = await GameRecord.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$user', totalWon: { $sum: '$winAmount' }, sessionsPlayed: { $sum: 1 } } },
      { $sort: { totalWon: -1 } },
      { $limit: parseInt(limit) },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $unwind: '$userInfo' },
      { $project: { _id: 1, totalWon: 1, sessionsPlayed: 1, name: '$userInfo.name', avatar: '$userInfo.avatar', uid: '$userInfo.uid' } }
    ]);

    return res.status(200).json({ success: true, leaderboard, period });
  } catch (error) {
    console.error('Get Game Leaderboard Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};