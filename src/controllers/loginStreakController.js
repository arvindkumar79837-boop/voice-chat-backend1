const LoginStreak = require('../models/LoginStreak');
const User = require('../models/User');

// ─── GET USER LOGIN STREAK ────────────────────────────────────────────
exports.getLoginStreak = async (req, res) => {
  try {
    const userId = req.user.userId;
    let streak = await LoginStreak.findOne({ userId });
    if (!streak) {
      streak = await LoginStreak.create({ userId });
    }
    res.status(200).json({ success: true, data: streak });
  } catch (error) {
    console.error('Get LoginStreak Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch login streak' });
  }
};

// ─── CLAIM DAILY LOGIN (Called on app open) ────────────────────────────
exports.claimDailyLogin = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let streak = await LoginStreak.findOne({ userId });
    if (!streak) {
      streak = await LoginStreak.create({ userId });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastLogin = streak.last_login_date ? new Date(streak.last_login_date) : null;

    // Check if already claimed today
    if (lastLogin) {
      const lastLoginDay = new Date(lastLogin);
      lastLoginDay.setHours(0, 0, 0, 0);
      if (lastLoginDay.getTime() === today.getTime()) {
        return res.status(200).json({
          success: true,
          data: streak,
          already_claimed_today: true,
          message: 'Already claimed today\'s login reward'
        });
      }
    }

    // Calculate streak
    let newStreak = 1;
    if (lastLogin) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastLoginDay = new Date(lastLogin);
      lastLoginDay.setHours(0, 0, 0, 0);

      if (lastLoginDay.getTime() === yesterday.getTime()) {
        newStreak = streak.current_streak + 1;
      } else if (lastLoginDay.getTime() < yesterday.getTime()) {
        newStreak = 1; // Streak broken
      }
    }

    streak.current_streak = newStreak;
    if (newStreak > streak.longest_streak) {
      streak.longest_streak = newStreak;
    }
    streak.last_login_date = today;
    streak.total_logins += 1;

    // Determine reward based on streak day
    let rewardCoins = 0;
    let rewardDiamonds = 0;
    let rewardXp = 0;
    let rewardType = 'daily_login';
    let specialReward = null;

    const dayKey = `day_${Math.min(newStreak, 30)}`;
    const dayRewards = streak.daily_rewards[dayKey] || streak.daily_rewards.day_1;

    rewardCoins = dayRewards?.coins || 10;
    rewardDiamonds = dayRewards?.diamonds || 0;
    rewardXp = dayRewards?.xp || 5;

    // Special milestone rewards
    if (newStreak === 7 && !streak.day_7_reward_claimed) {
      streak.day_7_reward_claimed = true;
      rewardCoins += 100;
      rewardDiamonds += 10;
      rewardXp += 50;
      rewardType = '7_day_streak';
    }

    if (newStreak === 30 && !streak.day_30_reward_claimed) {
      streak.day_30_reward_claimed = true;
      rewardCoins += 500;
      rewardDiamonds += 50;
      rewardXp += 200;
      rewardType = '30_day_streak';
      const badgeId = streak.daily_rewards.day_30?.special_badge || 'loyal_fighter';
      user.unlockedBadges = user.unlockedBadges || [];
      if (!user.unlockedBadges.includes(badgeId)) {
        user.unlockedBadges.push(badgeId);
        specialReward = { type: 'badge', id: badgeId, name: 'Loyal Fighter' };
      }
    }

    // Special rewards at specific milestones
    const specialMilestones = [3, 5, 10, 15, 20, 25];
    if (specialMilestones.includes(newStreak)) {
      const bubbleId = `chat_bubble_streak_${newStreak}`;
      streak.special_rewards_unlocked.push({
        type: 'chat_bubble',
        id: bubbleId,
        name: `Streak ${newStreak} Bubble`,
        streak_milestone: newStreak
      });
      specialReward = { type: 'chat_bubble', id: bubbleId, name: `Streak ${newStreak} Bubble` };
    }

    // Apply rewards to user
    user.coins = (user.coins || 0) + rewardCoins;
    user.diamonds = (user.diamonds || 0) + rewardDiamonds;
    user.xp = (user.xp || 0) + rewardXp;
    await user.save();

    // Record login history
    streak.login_history.push({
      date: today,
      rewarded: true,
      reward_type: rewardType,
      reward_value: rewardCoins + rewardDiamonds
    });
    // Keep only last 30 days
    if (streak.login_history.length > 30) {
      streak.login_history = streak.login_history.slice(-30);
    }
    streak.total_rewards_claimed += 1;
    await streak.save();

    res.status(200).json({
      success: true,
      data: {
        streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        reward: { coins: rewardCoins, diamonds: rewardDiamonds, xp: rewardXp },
        reward_type: rewardType,
        special_reward: specialReward,
        total_logins: streak.total_logins,
        day_7_claimed: streak.day_7_reward_claimed,
        day_30_claimed: streak.day_30_reward_claimed,
        special_rewards_unlocked: streak.special_rewards_unlocked
      }
    });
  } catch (error) {
    console.error('Claim Daily Login Error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim daily login' });
  }
};

// ─── ADMIN: GET ALL USER STREAKS ──────────────────────────────────────
exports.adminGetAllStreaks = async (req, res) => {
  try {
    const streaks = await LoginStreak.find()
      .populate('userId', 'username uid coins')
      .sort({ current_streak: -1 })
      .limit(200);
    res.status(200).json({ success: true, data: streaks });
  } catch (error) {
    console.error('Admin Get Streaks Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch streaks' });
  }
};

// ─── ADMIN: RESET USER STREAK ─────────────────────────────────────────
exports.adminResetStreak = async (req, res) => {
  try {
    const { userId } = req.params;
    const streak = await LoginStreak.findOneAndUpdate(
      { userId },
      { current_streak: 0, day_7_reward_claimed: false, day_30_reward_claimed: false },
      { new: true }
    );
    if (!streak) {
      return res.status(404).json({ success: false, message: 'Streak not found' });
    }
    res.status(200).json({ success: true, message: 'Streak reset', data: streak });
  } catch (error) {
    console.error('Admin Reset Streak Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset streak' });
  }
};