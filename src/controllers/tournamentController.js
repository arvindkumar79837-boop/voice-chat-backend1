const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Championship = require('../models/Championship');
const redisRankingService = require('../services/redisRankingService');

// ─── TOURNAMENT CRUD ───────────────────────────────────────────────────

exports.createTournament = async (req, res) => {
  try {
    const payload = req.body;
    const createdBy = req.user.userId;

    if (!payload.tournament_name || !payload.event_type || !payload.start_time || !payload.end_time) {
      return res.status(400).json({ success: false, message: 'Missing required tournament fields' });
    }

    const tournament = await Tournament.create({
      ...payload,
      created_by: createdBy,
      status: 'upcoming'
    });

    res.status(201).json({ success: true, message: 'Tournament created successfully', data: tournament });
  } catch (error) {
    console.error('Create Tournament Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create tournament' });
  }
};

exports.getTournaments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, event_type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { is_active: true };
    if (status) query.status = status;
    if (event_type) query.event_type = event_type;

    const tournaments = await Tournament.find(query)
      .populate('created_by', 'name avatar')
      .sort({ start_time: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tournament.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tournaments,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get Tournaments Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tournaments' });
  }
};

exports.getTournamentById = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId).populate('created_by', 'name avatar');

    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    console.error('Get Tournament Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tournament' });
  }
};

exports.registerForTournament = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const userId = req.user.userId;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    if (tournament.status !== 'registration_open') {
      return res.status(400).json({ success: false, message: 'Registration is not open' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existingParticipant = tournament.participants.find(p => p.userId.toString() === userId.toString());
    if (existingParticipant) {
      return res.status(400).json({ success: false, message: 'Already registered' });
    }

    if (tournament.entry_fee > 0 && user.coins < tournament.entry_fee) {
      return res.status(400).json({ success: false, message: 'Insufficient coins for entry fee' });
    }

    if (tournament.entry_fee > 0) {
      user.coins -= tournament.entry_fee;
      await user.save();
    }

    tournament.participants.push({
      userId: user._id,
      username: user.username,
      registered_at: new Date(),
      current_round: 1,
      score: 0,
      is_eliminated: false,
      final_rank: 0
    });
    tournament.participants_count = tournament.participants.length;
    await tournament.save();

    res.status(200).json({ success: true, message: 'Registered successfully', data: tournament });
  } catch (error) {
    console.error('Register Tournament Error:', error);
    res.status(500).json({ success: false, message: 'Failed to register' });
  }
};

exports.updateTournamentScore = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { userId, score, is_eliminated, final_rank } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament || tournament.status !== 'live') {
      return res.status(400).json({ success: false, message: 'Tournament not live' });
    }

    const participant = tournament.participants.find(p => p.userId.toString() === userId.toString());
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    if (score !== undefined) participant.score += score;
    if (is_eliminated !== undefined) participant.is_eliminated = is_eliminated;
    if (final_rank !== undefined) participant.final_rank = final_rank;

    await tournament.save();

    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    console.error('Update Tournament Score Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update score' });
  }
};

exports.completeTournament = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId);

    if (!tournament || tournament.status !== 'live') {
      return res.status(400).json({ success: false, message: 'Tournament not live' });
    }

    tournament.status = 'completed';
    tournament.participants.sort((a, b) => b.score - a.score);

    tournament.participants.forEach((p, index) => {
      p.final_rank = index + 1;
    });

    await tournament.save();

    await distributeTournamentRewards(tournament);

    res.status(200).json({ success: true, message: 'Tournament completed', data: tournament });
  } catch (error) {
    console.error('Complete Tournament Error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete tournament' });
  }
};

async function distributeTournamentRewards(tournament) {
  const rewards = tournament.rewards;
  const top3 = tournament.participants.filter(p => p.final_rank <= 3).sort((a, b) => a.final_rank - b.final_rank);

  for (const participant of top3) {
    const user = await User.findById(participant.userId);
    if (!user) continue;

    const rank = participant.final_rank;
    let rewardKey = '';
    if (rank === 1) rewardKey = 'first';
    else if (rank === 2) rewardKey = 'second';
    else if (rank === 3) rewardKey = 'third';

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

    await user.save();

    if (reward.cashPrize > 0 && tournament.metadata.agencyId) {
      const Agency = require('../models/Agency');
      const agency = await Agency.findById(tournament.metadata.agencyId);
      if (agency) {
        agency.earnings = (agency.earnings || 0) + reward.cashPrize;
        await agency.save();
      }
    }
  }

  for (const participant of tournament.participants) {
    if (participant.final_rank > 3) {
      const user = await User.findById(participant.userId);
      if (user && rewards.participation) {
        user.coins = (user.coins || 0) + (rewards.participation.coins || 0);
        user.xp = (user.xp || 0) + (rewards.participation.xp || 0);
        await user.save();
      }
    }
  }
}

exports.getTournamentLeaderboard = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId);

    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const sorted = tournament.participants
      .filter(p => !p.is_eliminated)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);

    res.status(200).json({ success: true, data: sorted, total: tournament.participants_count });
  } catch (error) {
    console.error('Get Tournament Leaderboard Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
};

exports.adminGetAllTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find()
      .populate('created_by', 'name avatar')
      .sort({ created_at: -1 });

    res.status(200).json({ success: true, data: tournaments });
  } catch (error) {
    console.error('Admin Get Tournaments Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tournaments' });
  }
};