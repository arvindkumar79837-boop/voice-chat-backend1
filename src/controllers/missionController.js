const User = require('../models/User');
const MissionProgress = require('../models/MissionProgress');

// You can expand this array to add as many missions as you want!
const DAILY_MISSIONS = [
  { id: 'm1', title: 'Daily Check-in', description: 'Log into the app today.', target: 1, type: 'dailyLogin', rewardCoins: 10 },
  { id: 'm2', title: 'Arcade Player', description: 'Play Lucky Wheel or Scratch Card.', target: 2, type: 'gamesPlayed', rewardCoins: 30 },
  { id: 'm3', title: 'Generous Friend', description: 'Send virtual gifts in a live room.', target: 5, type: 'giftsSent', rewardCoins: 50 },
];

exports.getMissions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    let progress = await MissionProgress.findOne({ user: userId });
    
    // Dynamically reset the user's progress if it's a new day
    if (!progress || progress.lastResetDate !== today) {
      if (progress) {
        progress.lastResetDate = today;
        progress.dailyLogin = 1; // They just logged in!
        progress.gamesPlayed = 0;
        progress.giftsSent = 0;
        progress.claimedMissions = [];
        await progress.save();
      } else {
        progress = await MissionProgress.create({ user: userId, lastResetDate: today, dailyLogin: 1 });
      }
    } else if (progress.dailyLogin === 0) {
      progress.dailyLogin = 1;
      await progress.save();
    }

    const missionsWithProgress = DAILY_MISSIONS.map(mission => {
      const currentProgress = progress[mission.type] || 0;
      return {
        ...mission,
        currentProgress: Math.min(currentProgress, mission.target),
        isCompleted: currentProgress >= mission.target,
        isClaimed: progress.claimedMissions.includes(mission.id)
      };
    });

    res.status(200).json({ success: true, missions: missionsWithProgress });
  } catch (error) {
    console.error('Get Missions Error:', error);
    res.status(500).json({ error: 'Failed to load missions' });
  }
};

exports.claimReward = async (req, res) => {
  try {
    const { missionId } = req.body;
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    const mission = DAILY_MISSIONS.find(m => m.id === missionId);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });

    const progress = await MissionProgress.findOne({ user: userId });
    if (!progress || progress.lastResetDate !== today) return res.status(400).json({ error: 'Progress out of sync. Please refresh.' });
    if (progress.claimedMissions.includes(missionId)) return res.status(400).json({ error: 'Reward already claimed' });
    if ((progress[mission.type] || 0) < mission.target) return res.status(400).json({ error: 'Mission not completed yet' });

    // Claim it and reward the user
    progress.claimedMissions.push(missionId);
    await progress.save();

    const user = await User.findById(userId);
    user.coins = (user.coins || 0) + mission.rewardCoins;
    await user.save();

    res.status(200).json({ success: true, message: 'Reward claimed!', rewardCoins: mission.rewardCoins, balance: { coins: user.coins }});
  } catch (error) {
    console.error('Claim Reward Error:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
};