const Championship = require('../models/Championship');
const User = require('../models/User');
const Tournament = require('../models/Tournament');

// ─── CHAMPIONSHIP CRUD ─────────────────────────────────────────────────

exports.createChampionship = async (req, res) => {
  try {
    const payload = req.body;
    const createdBy = req.user.userId;

    if (!payload.championship_name || !payload.period_type || !payload.start_time || !payload.end_time) {
      return res.status(400).json({ success: false, message: 'Missing required championship fields' });
    }

    const championship = await Championship.create({
      ...payload,
      created_by: createdBy,
      status: 'upcoming'
    });

    res.status(201).json({ success: true, message: 'Championship created successfully', data: championship });
  } catch (error) {
    console.error('Create Championship Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create championship' });
  }
};

exports.getChampionships = async (req, res) => {
  try {
    const { page = 1, limit = 20, period_type, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { is_active: true };
    if (period_type) query.period_type = period_type;
    if (status) query.status = status;

    const championships = await Championship.find(query)
      .populate('created_by', 'name avatar')
      .populate('winner_id', 'name avatar uid')
      .sort({ start_time: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Championship.countDocuments(query);

    res.status(200).json({
      success: true,
      data: championships,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get Championships Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch championships' });
  }
};

exports.getChampionshipById = async (req, res) => {
  try {
    const { championshipId } = req.params;
    const championship = await Championship.findById(championshipId)
      .populate('created_by', 'name avatar')
      .populate('winner_id', 'name avatar uid');

    if (!championship) {
      return res.status(404).json({ success: false, message: 'Championship not found' });
    }

    res.status(200).json({ success: true, data: championship });
  } catch (error) {
    console.error('Get Championship Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch championship' });
  }
};

exports.qualifyForChampionship = async (req, res) => {
  try {
    const { championshipId } = req.params;
    const userId = req.user.userId;

    const championship = await Championship.findById(championshipId);
    if (!championship) {
      return res.status(404).json({ success: false, message: 'Championship not found' });
    }

    if (championship.status !== 'qualification') {
      return res.status(400).json({ success: false, message: 'Qualification period is not open' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existingParticipant = championship.participants.find(p => p.userId.toString() === userId.toString());
    if (existingParticipant) {
      return res.status(400).json({ success: false, message: 'Already qualified' });
    }

    let userScore = 0;
    switch (championship.criteria.metric) {
      case 'total_gifts_sent':
        userScore = user.totalGiftsSent || 0;
        break;
      case 'total_gifts_received':
        userScore = user.totalGiftsReceived || 0;
        break;
      case 'total_coins':
        userScore = user.coins || 0;
        break;
      case 'total_diamonds':
        userScore = user.diamonds || 0;
        break;
      case 'pk_wins':
        userScore = await getPKWins(userId);
        break;
      case 'family_contribution':
        userScore = user.familyContribution || 0;
        break;
      default:
        userScore = 0;
    }

    if (userScore < championship.criteria.min_score) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${championship.criteria.metric}. Required: ${championship.criteria.min_score}, Your score: ${userScore}`
      });
    }

    if (championship.participants_count >= championship.criteria.max_participants) {
      return res.status(400).json({ success: false, message: 'Championship is full' });
    }

    championship.participants.push({
      userId: user._id,
      username: user.username,
      score: userScore,
      qualified_at: new Date(),
      final_rank: 0,
      rewards_claimed: false
    });
    championship.participants_count = championship.participants.length;
    await championship.save();

    res.status(200).json({ success: true, message: 'Qualified successfully', data: championship });
  } catch (error) {
    console.error('Qualify Championship Error:', error);
    res.status(500).json({ success: false, message: 'Failed to qualify' });
  }
};

async function getPKWins(userId) {
  try {
    const PKBattle = require('../models/PKBattle');
    const wins = await PKBattle.countDocuments({
      $or: [
        { hostId: userId, winnerId: userId, status: 'finished' },
        { opponentId: userId, winnerId: userId, status: 'finished' }
      ]
    });
    return wins;
  } catch (error) {
    return 0;
  }
}

exports.completeChampionship = async (req, res) => {
  try {
    const { championshipId } = req.params;
    const championship = await Championship.findById(championshipId);

    if (!championship || championship.status !== 'live') {
      return res.status(400).json({ success: false, message: 'Championship not live' });
    }

    championship.status = 'completed';
    championship.participants.sort((a, b) => b.score - a.score);

    championship.participants.forEach((p, index) => {
      p.final_rank = index + 1;
    });

    if (championship.participants.length > 0) {
      championship.winner_id = championship.participants[0].userId;
      championship.winner_username = championship.participants[0].username;
    }

    await championship.save();

    await distributeChampionshipRewards(championship);

    res.status(200).json({ success: true, message: 'Championship completed', data: championship });
  } catch (error) {
    console.error('Complete Championship Error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete championship' });
  }
};

async function distributeChampionshipRewards(championship) {
  const rewards = championship.rewards;

  for (const participant of championship.participants) {
    const user = await User.findById(participant.userId);
    if (!user) continue;

    let rewardKey = '';
    if (participant.final_rank === 1) rewardKey = 'winner';
    else if (participant.final_rank === 2) rewardKey = 'runner_up';
    else if (participant.final_rank === 3) rewardKey = 'third_place';
    else if (participant.final_rank <= 100) rewardKey = 'top100';
    else continue;

    const reward = rewards[rewardKey];
    if (!reward) continue;

    user.coins = (user.coins || 0) + (reward.coins || 0);
    user.diamonds = (user.diamonds || 0) + (reward.diamonds || 0);
    user.xp = (user.xp || 0) + (reward.xp || 0);

    if (reward.vipTag && reward.vipTag.trim() !== '') {
      user.unlockedBadges = user.unlockedBadges || [];
      if (!user.unlockedBadges.includes(reward.vipTag)) {
        user.unlockedBadges.push(reward.vipTag);
      }
    }

    if (reward.specialFrame && reward.specialFrame.trim() !== '') {
      user.unlockedFrames = user.unlockedFrames || [];
      if (!user.unlockedFrames.includes(reward.specialFrame)) {
        user.unlockedFrames.push(reward.specialFrame);
      }
    }

    participant.rewards_claimed = true;
    await user.save();
  }

  await championship.save();
}

exports.getChampionshipLeaderboard = async (req, res) => {
  try {
    const { championshipId } = req.params;
    const championship = await Championship.findById(championshipId);

    if (!championship) {
      return res.status(404).json({ success: false, message: 'Championship not found' });
    }

    const sorted = championship.participants
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);

    res.status(200).json({ success: true, data: sorted, total: championship.participants_count });
  } catch (error) {
    console.error('Get Championship Leaderboard Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
};

exports.claimChampionshipRewards = async (req, res) => {
  try {
    const { championshipId } = req.params;
    const userId = req.user.userId;

    const championship = await Championship.findById(championshipId);
    if (!championship || championship.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Championship not completed' });
    }

    const participant = championship.participants.find(p => p.userId.toString() === userId.toString());
    if (!participant) {
      return res.status(404).json({ success: false, message: 'You were not a participant' });
    }

    if (participant.rewards_claimed) {
      return res.status(400).json({ success: false, message: 'Rewards already claimed' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let rewardKey = '';
    if (participant.final_rank === 1) rewardKey = 'winner';
    else if (participant.final_rank === 2) rewardKey = 'runner_up';
    else if (participant.final_rank === 3) rewardKey = 'third_place';
    else if (participant.final_rank <= 100) rewardKey = 'top100';
    else return res.status(400).json({ success: false, message: 'No rewards for this rank' });

    const reward = championship.rewards[rewardKey];
    if (!reward) {
      return res.status(400).json({ success: false, message: 'No rewards available' });
    }

    user.coins = (user.coins || 0) + (reward.coins || 0);
    user.diamonds = (user.diamonds || 0) + (reward.diamonds || 0);
    user.xp = (user.xp || 0) + (reward.xp || 0);

    if (reward.vipDays > 0) {
      if (!user.isVip) {
        user.isVip = true;
        user.vipExpiry = new Date(Date.now() + reward.vipDays * 24 * 60 * 60 * 1000);
      } else {
        user.vipExpiry = new Date((user.vipExpiry || Date.now()) + reward.vipDays * 24 * 60 * 60 * 1000);
      }
    }

    if (reward.vipTag && reward.vipTag.trim() !== '') {
      user.unlockedBadges = user.unlockedBadges || [];
      if (!user.unlockedBadges.includes(reward.vipTag)) {
        user.unlockedBadges.push(reward.vipTag);
      }
    }

    if (reward.specialFrame && reward.specialFrame.trim() !== '') {
      user.unlockedFrames = user.unlockedFrames || [];
      if (!user.unlockedFrames.includes(reward.specialFrame)) {
        user.unlockedFrames.push(reward.specialFrame);
      }
    }

    participant.rewards_claimed = true;
    await user.save();
    await championship.save();

    res.status(200).json({ success: true, message: 'Rewards claimed successfully', data: { user, rank: participant.final_rank } });
  } catch (error) {
    console.error('Claim Championship Rewards Error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim rewards' });
  }
};

exports.adminGetAllChampionships = async (req, res) => {
  try {
    const championships = await Championship.find()
      .populate('created_by', 'name avatar')
      .populate('winner_id', 'name avatar uid')
      .sort({ created_at: -1 });

    res.status(200).json({ success: true, data: championships });
  } catch (error) {
    console.error('Admin Get Championships Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch championships' });
  }
};