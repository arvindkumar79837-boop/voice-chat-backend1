const User = require('../models/User');
const GameRecord = require('../models/GameRecord');
let cron = null;
try {
  cron = require('node-cron');
} catch (e) {
  console.warn('⚠️ node-cron package not available. Weekly champion cron disabled.');
}
const MissionProgress = require('../models/MissionProgress');

exports.playLuckyWheel = async (req, res) => {
  try {
    const userId = req.user.userId;
    const betAmount = 50; // Cost to spin the wheel

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if ((user.coins || 0) < betAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient coins to play' });
    }

    // Deduct bet amount
    user.coins -= betAmount;

    // Define Wheel Rewards & Probabilities
    const rewards = [
      { type: 'NOTHING', amount: 0, probability: 40 },
      { type: 'COINS', amount: 20, probability: 30 },
      { type: 'COINS', amount: 100, probability: 20 },
      { type: 'COINS', amount: 500, probability: 8 },
      { type: 'DIAMONDS', amount: 10, probability: 2 }
    ];

    // Random pick based on cumulative probability
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedReward = rewards[0];
    for (const reward of rewards) {
      cumulative += reward.probability;
      if (rand <= cumulative) {
        selectedReward = reward;
        break;
      }
    }

    // Credit the won amount securely
    if (selectedReward.type === 'COINS') user.coins += selectedReward.amount;
    if (selectedReward.type === 'DIAMONDS') user.diamonds = (user.diamonds || 0) + selectedReward.amount;
    await user.save();

    // Log the transaction
    await GameRecord.create({
      user: userId,
      gameType: 'LUCKY_WHEEL',
      betAmount,
      winAmount: selectedReward.amount,
      rewardType: selectedReward.type
    });

    // Update Daily Mission Progress
    const today = new Date().toISOString().split('T')[0];
    let progress = await MissionProgress.findOne({ user: userId });
    if (progress) {
      if (progress.lastResetDate !== today) {
        progress.lastResetDate = today; progress.dailyLogin = 1; progress.gamesPlayed = 1; progress.giftsSent = 0; progress.claimedMissions = [];
      } else {
        progress.gamesPlayed += 1;
      }
      await progress.save();
    } else {
      await MissionProgress.create({ user: userId, lastResetDate: today, dailyLogin: 1, gamesPlayed: 1 });
    }

    res.status(200).json({ success: true, reward: selectedReward, balance: { coins: user.coins, diamonds: user.diamonds }});
  } catch (error) {
    console.error('Lucky Wheel Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.playScratchCard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const betAmount = 20; // Cost to buy a scratch card

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if ((user.coins || 0) < betAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient coins to play' });
    }

    // Deduct bet amount
    user.coins -= betAmount;

    // Define Scratch Card Rewards & Probabilities
    const rewards = [
      { type: 'NOTHING', amount: 0, probability: 45 },
      { type: 'COINS', amount: 20, probability: 30 }, // Break even
      { type: 'COINS', amount: 50, probability: 15 }, // Small win
      { type: 'COINS', amount: 200, probability: 8 }, // Big win
      { type: 'DIAMONDS', amount: 5, probability: 2 } // Jackpot
    ];

    // Random pick based on cumulative probability
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedReward = rewards[0];
    for (const reward of rewards) {
      cumulative += reward.probability;
      if (rand <= cumulative) {
        selectedReward = reward;
        break;
      }
    }

    // Credit the won amount securely
    if (selectedReward.type === 'COINS') user.coins += selectedReward.amount;
    if (selectedReward.type === 'DIAMONDS') user.diamonds = (user.diamonds || 0) + selectedReward.amount;
    await user.save();

    // Log the transaction
    await GameRecord.create({ user: userId, gameType: 'SCRATCH_CARD', betAmount, winAmount: selectedReward.amount, rewardType: selectedReward.type });

    // Update Daily Mission Progress
    const today = new Date().toISOString().split('T')[0];
    let progress = await MissionProgress.findOne({ user: userId });
    if (progress) {
      if (progress.lastResetDate !== today) {
        progress.lastResetDate = today; progress.dailyLogin = 1; progress.gamesPlayed = 1; progress.giftsSent = 0; progress.claimedMissions = [];
      } else {
        progress.gamesPlayed += 1;
      }
      await progress.save();
    } else {
      await MissionProgress.create({ user: userId, lastResetDate: today, dailyLogin: 1, gamesPlayed: 1 });
    }

    res.status(200).json({ success: true, reward: selectedReward, balance: { coins: user.coins, diamonds: user.diamonds }});
  } catch (error) {
    console.error('Scratch Card Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    // Calculate the date 7 days ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const leaderboard = await GameRecord.aggregate([
      // 1. Match games from the last 7 days where the user actually won coins
      { 
        $match: { 
          createdAt: { $gte: oneWeekAgo },
          winAmount: { $gt: 0 },
          rewardType: 'COINS'
        } 
      },
      // 2. Group by user and sum up their total coins won
      { 
        $group: { 
          _id: '$user', 
          totalWon: { $sum: '$winAmount' } 
        } 
      },
      // 3. Sort descending to get the top winners first
      { $sort: { totalWon: -1 } },
      // 4. Limit to the Top 10 Winners
      { $limit: 10 },
      // 5. Lookup the user's profile information
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      // 6. Flatten the userInfo array
      { $unwind: '$userInfo' },
      // 7. Project only the fields we need to send to the frontend app
      { $project: { _id: 1, totalWon: 1, name: '$userInfo.name', avatar: '$userInfo.avatar' } }
    ]);

    res.status(200).json({ success: true, leaderboard });
  } catch (error) {
    console.error('Leaderboard Error:', error);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
};

exports.processWeeklyChampion = async (io) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const leaderboard = await GameRecord.aggregate([
      { 
        $match: { 
          createdAt: { $gte: oneWeekAgo },
          winAmount: { $gt: 0 },
          rewardType: 'COINS'
        } 
      },
      { 
        $group: { 
          _id: '$user', 
          totalWon: { $sum: '$winAmount' } 
        } 
      },
      { $sort: { totalWon: -1 } },
      { $limit: 1 } // Only fetch the #1 player!
    ]);

    if (leaderboard.length > 0) {
      const topPlayerId = leaderboard[0]._id;
      
      // Safely award the badge without duplicates using $addToSet
      // (Note: ensure 'unlockedBadges' matches the actual array field in your User Schema)
      await User.findByIdAndUpdate(topPlayerId, {
        $addToSet: { unlockedBadges: 'WEEKLY_CHAMPION_BADGE_ID' }
      });
      
      console.log(`🏆 Weekly Champion Badge awarded to user ID: ${topPlayerId}`);

      // Emit real-time notification to the app via Socket.IO
      if (io) {
        io.emit('badge_unlocked', { userId: topPlayerId, badgeId: 'WEEKLY_CHAMPION_BADGE_ID' });
      }
    }
  } catch (error) {
    console.error('Weekly Champion Cron Error:', error);
  }
};

exports.initGameCronJobs = (io) => {
  // Runs every Sunday at 23:59 (11:59 PM)
  cron.schedule('59 23 * * 0', async () => {
    console.log('Running Weekly Champion Cron Job...');
    await exports.processWeeklyChampion(io);
  });
};