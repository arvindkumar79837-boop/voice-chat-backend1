const InviteEvent = require('../models/InviteEvent');
const User = require('../models/User');
const crypto = require('crypto');

// ─── GENERATE INVITE LINK ─────────────────────────────────────────────
exports.generateInviteLink = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check for existing active invite
    let invite = await InviteEvent.findOne({ inviter_id: userId, status: 'pending', is_active: true });
    if (invite) {
      return res.status(200).json({
        success: true,
        data: {
          invite_code: invite.invite_code,
          invite_link: invite.invite_link,
          commission_percent: invite.commission_percent
        }
      });
    }

    // Generate unique invite code
    const inviteCode = user.uid || user._id.toString().slice(-8);
    const uniqueCode = `${inviteCode}_${crypto.randomBytes(3).toString('hex')}`;
    const appBaseUrl = process.env.APP_BASE_URL || 'https://arvindparty.app';
    const inviteLink = `${appBaseUrl}/invite?code=${uniqueCode}`;

    const commissionPercent = req.body.commission_percent || 5;

    invite = await InviteEvent.create({
      inviter_id: userId,
      invite_code: uniqueCode,
      invite_link: inviteLink,
      commission_percent: Math.min(Math.max(commissionPercent, 1), 20),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      metadata: {
        inviter_username: user.username || 'User'
      }
    });

    res.status(201).json({
      success: true,
      data: {
        invite_code: invite.invite_code,
        invite_link: invite.invite_link,
        commission_percent: invite.commission_percent
      }
    });
  } catch (error) {
    console.error('Generate Invite Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate invite link' });
  }
};

// ─── REGISTER VIA INVITE (When new user signs up with invite code) ────
exports.registerViaInvite = async (req, res) => {
  try {
    const { invite_code } = req.body;
    const newUserId = req.user.userId;

    if (!invite_code) {
      return res.status(400).json({ success: false, message: 'Invite code required' });
    }

    const invite = await InviteEvent.findOne({ invite_code, is_active: true, status: 'pending' });
    if (!invite) {
      return res.status(400).json({ success: false, message: 'Invalid or expired invite code' });
    }

    // Prevent self-invite
    if (invite.inviter_id.toString() === newUserId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot invite yourself' });
    }

    // Check if invitee already used
    if (invite.invitee_id) {
      return res.status(400).json({ success: false, message: 'Invite code already used' });
    }

    const newUser = await User.findById(newUserId);
    if (!newUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    invite.invitee_id = newUserId;
    invite.status = 'registered';
    invite.invitee_joined_at = new Date();
    invite.metadata.invitee_username = newUser.username || 'New User';
    await invite.save();

    // Give small reward to inviter for successful referral
    const inviter = await User.findById(invite.inviter_id);
    if (inviter) {
      const welcomeBonus = 10; // Small coins for referring
      inviter.coins = (inviter.coins || 0) + welcomeBonus;
      await inviter.save();
    }

    // Give new user welcome bonus
    newUser.coins = (newUser.coins || 0) + 5;
    await newUser.save();

    res.status(200).json({
      success: true,
      message: 'Registered via invite successfully',
      data: {
        inviter_username: invite.metadata.inviter_username,
        welcome_bonus: 5
      }
    });
  } catch (error) {
    console.error('Register via Invite Error:', error);
    res.status(500).json({ success: false, message: 'Failed to register via invite' });
  }
};

// ─── COMMISSION ON INVITEE RECHARGE ───────────────────────────────────
exports.processRechargeCommission = async (req, res) => {
  try {
    const { userId, rechargeAmount } = req.body;
    if (!userId || !rechargeAmount) {
      return res.status(400).json({ success: false, message: 'userId and rechargeAmount required' });
    }

    // Find invite where this user was invited via
    const invite = await InviteEvent.findOne({ invitee_id: userId, status: 'registered', is_active: true });
    if (!invite) {
      return res.status(200).json({ success: false, message: 'No invite referral found for this user' });
    }

    const inviter = await User.findById(invite.inviter_id);
    if (!inviter) {
      return res.status(404).json({ success: false, message: 'Inviter not found' });
    }

    const commissionPercent = invite.commission_percent;
    const commissionCoins = Math.floor((rechargeAmount * commissionPercent) / 100);

    inviter.coins = (inviter.coins || 0) + commissionCoins;
    await inviter.save();

    invite.status = 'commission_paid';
    invite.commission_coins_earned = commissionCoins;
    invite.invitee_recharge_amount = rechargeAmount;
    invite.invitee_recharged_at = new Date();
    invite.commission_paid_at = new Date();
    await invite.save();

    res.status(200).json({
      success: true,
      message: `Commission of ${commissionCoins} coins paid to inviter`,
      data: {
        inviter_id: invite.inviter_id,
        inviter_username: invite.metadata.inviter_username,
        commission_coins: commissionCoins,
        commission_percent: commissionPercent,
        recharge_amount: rechargeAmount
      }
    });
  } catch (error) {
    console.error('Process Recharge Commission Error:', error);
    res.status(500).json({ success: false, message: 'Failed to process commission' });
  }
};

// ─── GET USER INVITE STATS ────────────────────────────────────────────
exports.getMyInviteStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const totalInvites = await InviteEvent.countDocuments({ inviter_id: userId });
    const registeredCount = await InviteEvent.countDocuments({ inviter_id: userId, status: { $ne: 'pending' } });
    const rechargedCount = await InviteEvent.countDocuments({ inviter_id: userId, status: 'commission_paid' });
    const totalCommissions = await InviteEvent.aggregate([
      { $match: { inviter_id: userId, status: 'commission_paid' } },
      { $group: { _id: null, total: { $sum: '$commission_coins_earned' } } }
    ]);

    const activeInvite = await InviteEvent.findOne({ inviter_id: userId, status: 'pending', is_active: true })
      .select('invite_code invite_link commission_percent');

    res.status(200).json({
      success: true,
      data: {
        total_invites: totalInvites,
        registered_count: registeredCount,
        recharged_count: rechargedCount,
        total_commission_coins: totalCommissions.length > 0 ? totalCommissions[0].total : 0,
        active_invite: activeInvite || null
      }
    });
  } catch (error) {
    console.error('Get Invite Stats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get invite stats' });
  }
};

// ─── ADMIN: GET ALL INVITES ───────────────────────────────────────────
exports.adminGetAllInvites = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) query.status = status;

    const invites = await InviteEvent.find(query)
      .populate('inviter_id', 'username uid')
      .populate('invitee_id', 'username uid')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await InviteEvent.countDocuments(query);

    res.status(200).json({
      success: true,
      data: invites,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Admin Get Invites Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch invites' });
  }
};

// ─── ADMIN: UPDATE COMMISSION PERCENT ─────────────────────────────────
exports.adminUpdateCommission = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { commission_percent } = req.body;

    if (!commission_percent || commission_percent < 1 || commission_percent > 50) {
      return res.status(400).json({ success: false, message: 'Commission must be between 1-50%' });
    }

    const invite = await InviteEvent.findByIdAndUpdate(
      inviteId,
      { commission_percent },
      { new: true }
    );

    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found' });
    }

    res.status(200).json({ success: true, data: invite });
  } catch (error) {
    console.error('Admin Update Commission Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update commission' });
  }
};