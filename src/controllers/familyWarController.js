const FamilyWar = require('../models/FamilyWar');
const Family = require('../models/Family');
const User = require('../models/User');
const GiftTransaction = require('../models/GiftTransaction');

const familyWarController = {};

familyWarController.createWar = async (req, res) => {
  try {
    const {
      war_type,
      family_1_id,
      family_2_id,
      start_time,
      end_time,
      title,
      description,
      rewards
    } = req.body;

    const created_by = req.user.userId || req.user.uid;
    const created_by_role = req.user.role || 'admin';

    const family1 = await Family.findOne({ family_id: family_1_id, is_active: true });
    const family2 = await Family.findOne({ family_id: family_2_id, is_active: true });

    if (!family1 || !family2) {
      return res.status(404).json({ success: false, message: 'One or both families not found' });
    }

    const warId = `WAR${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const war = new FamilyWar({
      war_id: warId,
      war_type: war_type || 'weekly_war',
      family_1_id: family_1_id,
      family_1_name: family1.family_name,
      family_2_id: family_2_id,
      family_2_name: family2.family_name,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      created_by,
      created_by_role,
      participants_family_1: family1.members_list,
      participants_family_2: family2.members_list
    });

    await war.save();

    await Promise.all([
      Family.findOneAndUpdate({ family_id: family_1_id }, { $inc: { 'war_stats.wars_participated': 1 } }),
      Family.findOneAndUpdate({ family_id: family_2_id }, { $inc: { 'war_stats.wars_participated': 1 } })
    ]);

    res.status(201).json({ success: true, message: 'War created successfully', data: war });
  } catch (error) {
    console.error('Create War Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create war' });
  }
};

familyWarController.getAllWars = async (req, res) => {
  try {
    const { status = 'all', war_type = 'all', page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (status !== 'all') query.status = status;
    if (war_type !== 'all') query.war_type = war_type;

    const wars = await FamilyWar.find(query).sort({ start_time: -1 }).skip(skip).limit(parseInt(limit)).lean();
    const total = await FamilyWar.countDocuments(query);

    res.status(200).json({
      success: true,
      data: wars,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get Wars Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch wars' });
  }
};

familyWarController.getActiveWars = async (req, res) => {
  try {
    const now = new Date();
    const wars = await FamilyWar.find({
      status: 'active',
      start_time: { $lte: now },
      end_time: { $gte: now }
    }).sort({ start_time: -1 }).lean();

    res.status(200).json({ success: true, data: wars });
  } catch (error) {
    console.error('Get Active Wars Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active wars' });
  }
};

familyWarController.getWarById = async (req, res) => {
  try {
    const { war_id } = req.params;
    const war = await FamilyWar.findOne({ war_id }).lean();
    if (!war) {
      return res.status(404).json({ success: false, message: 'War not found' });
    }
    res.status(200).json({ success: true, data: war });
  } catch (error) {
    console.error('Get War Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch war details' });
  }
};

familyWarController.updateWarStatus = async (req, res) => {
  try {
    const { war_id } = req.params;
    const { status } = req.body;

    if (!['scheduled', 'active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const war = await FamilyWar.findOne({ war_id });
    if (!war) {
      return res.status(404).json({ success: false, message: 'War not found' });
    }

    war.status = status;
    if (status === 'completed') {
      war.end_time = new Date();
      await determineWinner(war);
    } else if (status === 'active') {
      war.start_time = new Date();
    }
    await war.save();

    res.status(200).json({ success: true, message: 'War status updated', data: war });
  } catch (error) {
    console.error('Update War Status Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update war status' });
  }
};

async function determineWinner(war) {
  const family1 = await Family.findOne({ family_id: war.family_1_id });
  const family2 = await Family.findOne({ family_id: war.family_2_id });

  if (!family1 || !family2) return;

  war.winner_family_id = war.family_1_points > war.family_2_points ? war.family_1_id : war.family_2_id;
  war.winning_margin = Math.abs(war.family_1_points - war.family_2_points);

  const winningFamilyId = war.winner_family_id;
  const winningFamily = winningFamilyId === war.family_1_id ? family1 : family2;
  const losingFamily = winningFamilyId === war.family_1_id ? family2 : family1;

  winningFamily.war_stats.wars_won += 1;
  winningFamily.war_stats.total_war_points += war.family_1_points + war.family_2_points;

  await winningFamily.save();
  await losingFamily.save();

  const rewards = war.winner_family_id === war.family_1_id ? war.family_1_points : war.family_2_points;
  war.rewards_distributed = true;
  await war.save();
}

familyWarController.submitFamilyWarGift = async (req, res) => {
  try {
    const uid = req.user.uid || req.user.userId;
    const { war_id, gift_value } = req.body;

    const user = await User.findOne({ uid });
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family' });
    }

    const war = await FamilyWar.findOne({ war_id, status: 'active' });
    if (!war) {
      return res.status(404).json({ success: false, message: 'Active war not found' });
    }

    const isFamily1 = war.family_1_id === user.familyId;
    const isFamily2 = war.family_2_id === user.familyId;

    if (!isFamily1 && !isFamily2) {
      return res.status(403).json({ success: false, message: 'You are not part of this war' });
    }

    if (isFamily1) {
      war.family_1_points += gift_value;
      war.participants_family_1.push(user.uid);
    } else {
      war.family_2_points += gift_value;
      war.participants_family_2.push(user.uid);
    }

    war.total_gifts_sent += 1;
    await war.save();

    await User.findOneAndUpdate({ uid }, { $inc: { familyContribution: gift_value } });

    res.status(200).json({ success: true, message: 'Gift registered for war', war });
  } catch (error) {
    console.error('Submit War Gift Error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit war gift' });
  }
};

familyWarController.cancelWar = async (req, res) => {
  try {
    const { war_id } = req.params;
    const war = await FamilyWar.findOne({ war_id });
    if (!war) {
      return res.status(404).json({ success: false, message: 'War not found' });
    }
    war.status = 'cancelled';
    await war.save();
    res.status(200).json({ success: true, message: 'War cancelled' });
  } catch (error) {
    console.error('Cancel War Error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel war' });
  }
};

familyWarController.getWarLeaderboard = async (req, res) => {
  try {
    const { war_id } = req.params;
    const war = await FamilyWar.findOne({ war_id }).lean();
    if (!war) {
      return res.status(404).json({ success: false, message: 'War not found' });
    }

    const members1 = await User.find({ uid: { $in: war.participants_family_1 } })
      .select('uid username avatar level familyContribution')
      .lean();

    const members2 = await User.find({ uid: { $in: war.participants_family_2 } })
      .select('uid username avatar level familyContribution')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        family_1: { name: war.family_1_name, score: war.family_1_points, members: members1 },
        family_2: { name: war.family_2_name, score: war.family_2_points, members: members2 }
      }
    });
  } catch (error) {
    console.error('Get War Leaderboard Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch war leaderboard' });
  }
};

module.exports = familyWarController;