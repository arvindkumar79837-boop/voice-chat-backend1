const Family = require('../models/Family');
const FamilyTask = require('../models/FamilyTask');
const FamilyChat = require('../models/FamilyChatMessage');
const FamilyPK = require('../models/FamilyPK');
const FamilyWar = require('../models/FamilyWar');
const FamilyShopItem = require('../models/FamilyShopItem');
const FamilyInvitation = require('../models/FamilyInvitation');
const FamilyStayReward = require('../models/FamilyStayReward');
const FamilyLeaderboard = require('../models/FamilyLeaderboard');
const User = require('../models/User');
const GiftTransaction = require('../models/GiftTransaction');
const Ranking = require('../models/Ranking');
const mongoose = require('mongoose');
const redisRankingIntegration = require('../services/redisRankingIntegration');
const { getSocketIo } = require('../sockets/socketManager');

// ─── FAMILY CORE ───────────────────────────────────────────────────────

exports.getMyFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'No family found' });
    }

    const family = await Family.findOne({ familyId: user.familyId, is_active: true });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found or inactive' });
    }

    const members = await User.find({ familyId: family.familyId, isActive: true })
      .select('_id name avatar username role xp level coins diamonds vipLevel isVip familyRole familyContribution')
      .lean();

    const top3 = await FamilyLeaderboard.find({ familyId: family.familyId, period: 'all_time' })
      .sort({ rank: 1 })
      .limit(3)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...family.toObject(),
        members,
        myRole: user.familyRole,
        myUid: user.uid,
        topContributors: top3,
        maxAdminSlots: family.maxAdminSlots
      }
    });
  } catch (error) {
    console.error('Get My Family Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get family' });
  }
};

exports.createFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, family_badge, family_slogan, family_intro, creator_uid } = req.body;
    const effectiveUid = creator_uid || null;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.familyId) {
      return res.status(400).json({ success: false, message: 'You are already in a family.' });
    }

    const userLevel = user.level || 1;
    const requiredLevel = 5;
    const creationCost = 1000;

    if (userLevel < requiredLevel) {
      return res.status(400).json({ success: false, message: `You must be at least level ${requiredLevel} to create a family.` });
    }

    if ((user.coins || 0) < creationCost) {
      return res.status(400).json({ success: false, message: `Insufficient coins. You need ${creationCost} coins to create a family.` });
    }

    const familyId = `FAM${Date.now().toString(36).toUpperCase()}`;
    const badge = family_badge ? family_badge.toUpperCase() : 'TEAM_ARVIND';

    const newFamily = new Family({
      familyId,
      family_name: name,
      family_badge: badge,
      family_slogan: family_slogan || '',
      family_intro: family_intro || '',
      creator_uid: effectiveUid || user.uid,
      current_level: 1,
      total_xp: 0,
      members_list: [user.uid],
      family_points: 0,
      total_wealth: 0,
      total_gifts_sent: 0,
      member_limit: 20,
      max_admin_slots: 5,
      admins_list: [{
        uid: user.uid,
        role: 'co_leader',
        assignedAt: new Date()
      }],
      unlocked_powers: ['basic_chat']
    });

    await newFamily.save();

    user.coins -= creationCost;
    user.familyId = familyId;
    user.familyRole = 'Patriarch';
    user.family = newFamily._id;
    await user.save();

    redisRankingIntegration.onFamilyActivity(familyId, 1, userId).catch(err => console.error('Redis family init failed:', err.message));

    res.status(201).json({ success: true, message: 'Family created successfully!', data: newFamily });
  } catch (error) {
    console.error('Error creating family:', error);
    res.status(500).json({ success: false, message: 'Server error while creating family' });
  }
};

exports.joinFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { familyId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.familyId) {
      return res.status(400).json({ success: false, message: 'You are already in a family.' });
    }

    const family = await Family.findOne({ familyId: familyId, is_active: true, is_banned: false });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found or inactive.' });
    }

    if (family.members_list.length >= family.member_limit) {
      return res.status(400).json({ success: false, message: 'Family is full. Please try another family.' });
    }

    user.familyId = family.familyId;
    user.familyRole = 'Member';
    user.family = family._id;
    await user.save();

    family.members_list.push(user.uid);
    await family.save();

    redisRankingIntegration.onFamilyActivity(familyId, 0, userId).catch(err => console.error('Redis family join failed:', err.message));

    const io = getSocketIo();
    io.to(`family:${familyId}`).emit('family:member_joined', {
      familyId,
      uid: user.uid,
      username: user.username || user.displayName,
      avatar: user.avatar
    });

    res.status(200).json({ success: true, message: 'Joined family successfully!', data: family });
  } catch (error) {
    console.error('Error joining family:', error);
    res.status(500).json({ success: false, message: 'Server error while joining family' });
  }
};

exports.leaveFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user || !user.familyId) {
      return res.status(400).json({ success: false, message: 'You are not in any family.' });
    }

    if (user.familyRole === 'Patriarch') {
      return res.status(400).json({ success: false, message: 'The Patriarch cannot leave. You must disband the family or transfer ownership.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    const leavingFamilyId = user.familyId;

    user.familyId = null;
    user.familyRole = null;
    user.family = null;
    await user.save();

    if (family) {
      family.members_list = family.members_list.filter(uid => uid !== user.uid);
      family.admins_list = family.admins_list.filter(admin => admin.uid !== user.uid);
      await family.save();
    }

    const io = getSocketIo();
    io.to(`family:${leavingFamilyId}`).emit('family:member_left', {
      familyId: leavingFamilyId,
      uid: user.uid,
      username: user.username || user.displayName
    });

    redisRankingIntegration.onFamilyActivity(leavingFamilyId, 0, userId).catch(err => console.error('Redis family leave failed:', err.message));

    res.status(200).json({ success: true, message: 'Left family successfully.' });
  } catch (error) {
    console.error('Error leaving family:', error);
    res.status(500).json({ success: false, message: 'Server error while leaving family' });
  }
};

exports.getFamilyInfo = async (req, res) => {
  try {
    const { familyId } = req.params;
    const family = await Family.findOne({ familyId, is_active: true });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const members = await User.find({ familyId: family.familyId, isActive: true })
      .select('_id name avatar username role xp level coins diamonds vipLevel isVip familyRole familyContribution')
      .lean();

    const top3 = await FamilyLeaderboard.find({ familyId: family.familyId, period: 'all_time' })
      .sort({ rank: 1 })
      .limit(3)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...family.toObject(),
        members,
        memberCount: members.length,
        topContributors: top3,
        maxAdminSlots: family.maxAdminSlots
      }
    });
  } catch (error) {
    console.error('Get Family Info Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get family info' });
  }
};

exports.updateFamilyDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { familyId, family_name, family_badge, family_slogan, family_intro, family_logo, announcement } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    if (user.familyRole !== 'Patriarch' && user.familyRole !== 'co_leader') {
      return res.status(403).json({ success: false, message: 'Only Patriarch and Co-leaders can update family details.' });
    }

    if (family_name) family.family_name = family_name;
    if (family_badge) family.family_badge = family_badge.toUpperCase();
    if (family_slogan !== undefined) family.family_slogan = family_slogan;
    if (family_intro !== undefined) family.family_intro = family_intro;
    if (family_logo !== undefined) family.family_logo = family_logo;
    if (announcement !== undefined) family.announcement = announcement;

    await family.save();

    const io = getSocketIo();
    io.to(`family:${family.familyId}`).emit('family:details_updated', {
      familyId: family.familyId,
      family_name: family.family_name,
      family_badge: family.family_badge,
      family_slogan: family.family_slogan,
      family_intro: family.family_intro,
      family_logo: family.family_logo,
      announcement: family.announcement
    });

    res.status(200).json({ success: true, message: 'Family details updated successfully!', data: family });
  } catch (error) {
    console.error('Update Family Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update family' });
  }
};

exports.searchFamilies = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const searchRegex = new RegExp(query, 'i');
    const families = await Family.find({
      $and: [
        { is_active: true, is_banned: false },
        { $or: [{ family_name: searchRegex }, { family_badge: searchRegex }] }
      ]
    })
      .sort({ total_xp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await Family.countDocuments({
      $and: [
        { is_active: true, is_banned: false },
        { $or: [{ family_name: searchRegex }, { family_badge: searchRegex }] }
      ]
    });

    res.status(200).json({ success: true, data: families, total: totalCount, page: parseInt(page) });
  } catch (error) {
    console.error('Search Families Error:', error);
    res.status(500).json({ success: false, message: 'Failed to search families' });
  }
};

exports.searchUsersByUid = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const searchRegex = new RegExp(query, 'i');
    const users = await User.find({
      isActive: true,
      isBanned: false,
      $or: [
        { uid: searchRegex },
        { username: searchRegex },
        { displayName: searchRegex }
      ]
    })
      .select('uid username displayName avatar level coins')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Search Users By UID Error:', error);
    res.status(500).json({ success: false, message: 'Failed to search users' });
  }
};

exports.searchUsersToInvite = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const { query = '', page = 1, limit = 20 } = req.query;

    const searchRegex = new RegExp(query, 'i');
    const users = await User.find({
      isActive: true,
      isBanned: false,
      familyId: { $ne: user.familyId },
      $or: [
        { uid: searchRegex },
        { username: searchRegex },
        { displayName: searchRegex }
      ]
    })
      .select('uid username displayName avatar level coins')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Search Users To Invite Error:', error);
    res.status(500).json({ success: false, message: 'Failed to search users' });
  }
};

// ─── FAMILY INVITATION SYSTEM ──────────────────────────────────────────

exports.sendInvitation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { receiverUid, message } = req.body;

    if (!receiverUid) {
      return res.status(400).json({ success: false, message: 'Receiver UID is required' });
    }

    const sender = await User.findById(userId);
    if (!sender || !sender.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    if (sender.familyRole !== 'Patriarch' && sender.familyRole !== 'co_leader') {
      return res.status(403).json({ success: false, message: 'Only Patriarch and Co-leaders can send invitations.' });
    }

    const family = await Family.findOne({ familyId: sender.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const receiver = await User.findOne({ uid: receiverUid, isActive: true, isBanned: false });
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (receiver.familyId) {
      return res.status(400).json({ success: false, message: 'This user is already in a family.' });
    }

    const existingPending = await FamilyInvitation.findOne({
      sender_uid: sender.uid,
      receiver_uid: receiverUid,
      familyId: sender.familyId,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({ success: false, message: 'A pending invitation already exists for this user.' });
    }

    const invitation = new FamilyInvitation({
      invitation_id: `INV${Date.now().toString(36).toUpperCase()}`,
      familyId: sender.familyId,
      family_name: family.family_name,
      family_badge: family.family_badge,
      sender_uid: sender.uid,
      sender_name: sender.displayName || sender.username,
      receiver_uid: receiverUid,
      message: message || `You are invited to join "${family.family_name}"!`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await invitation.save();

    const io = getSocketIo();
    if (receiver.socketId) {
      io.to(receiver.socketId).emit('family:invitation_received', {
        invitation_id: invitation.invitation_id,
        familyId: invitation.familyId,
        family_name: invitation.family_name,
        family_badge: invitation.family_badge,
        sender_name: invitation.sender_name,
        message: invitation.message,
        createdAt: invitation.createdAt
      });
    }

    res.status(201).json({ success: true, message: 'Invitation sent!', data: invitation });
  } catch (error) {
    console.error('Send Invitation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send invitation' });
  }
};

exports.getMyInvitations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { page = 1, limit = 20, status = 'pending' } = req.query;

    const invitations = await FamilyInvitation.find({
      receiver_uid: user.uid,
      status: status
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await FamilyInvitation.countDocuments({
      receiver_uid: user.uid,
      status: status
    });

    res.status(200).json({ success: true, data: invitations, total: totalCount });
  } catch (error) {
    console.error('Get My Invitations Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get invitations' });
  }
};

exports.getSentInvitations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { page = 1, limit = 20 } = req.query;
    const invitations = await FamilyInvitation.find({
      sender_uid: user.uid
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({ success: true, data: invitations });
  } catch (error) {
    console.error('Get Sent Invitations Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get sent invitations' });
  }
};

exports.respondToInvitation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { invitationId, action } = req.body;

    if (!action || !['accepted', 'rejected'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "accepted" or "rejected"' });
    }

    const invitation = await FamilyInvitation.findOne({
      invitation_id: invitationId,
      receiver_uid: user.uid,
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found or already responded' });
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = 'cancelled';
      await invitation.save();
      return res.status(400).json({ success: false, message: 'Invitation has expired' });
    }

    invitation.status = action;
    invitation.respondedAt = new Date();
    await invitation.save();

    if (action === 'accepted') {
      if (user.familyId) {
        return res.status(400).json({ success: false, message: 'You are already in a family.' });
      }

      const family = await Family.findOne({ familyId: invitation.familyId, is_active: true, is_banned: false });
      if (!family) {
        return res.status(404).json({ success: false, message: 'Family no longer exists or is inactive' });
      }

      if (family.members_list.length >= family.member_limit) {
        return res.status(400).json({ success: false, message: 'Family is full' });
      }

      user.familyId = family.familyId;
      user.familyRole = 'Member';
      user.familyJoinDate = new Date();
      await user.save();

      family.members_list.push(user.uid);
      await family.save();

      const io = getSocketIo();
      io.to(`family:${family.familyId}`).emit('family:member_joined', {
        familyId: family.familyId,
        uid: user.uid,
        username: user.username || user.displayName,
        avatar: user.avatar
      });

      res.status(200).json({ success: true, message: 'Invitation accepted! You have joined the family.', data: { familyId: family.familyId, family_name: family.family_name } });
    } else {
      res.status(200).json({ success: true, message: 'Invitation rejected.' });
    }
  } catch (error) {
    console.error('Respond To Invitation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to respond to invitation' });
  }
};

exports.cancelInvitation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { invitationId } = req.body;

    const invitation = await FamilyInvitation.findOne({
      invitation_id: invitationId,
      sender_uid: user.uid,
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    invitation.status = 'cancelled';
    invitation.respondedAt = new Date();
    await invitation.save();

    res.status(200).json({ success: true, message: 'Invitation cancelled.' });
  } catch (error) {
    console.error('Cancel Invitation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel invitation' });
  }
};

// ─── FAMILY ADMIN MANAGEMENT ───────────────────────────────────────────

exports.assignAdmin = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUid, adminRole } = req.body;

    const owner = await User.findById(userId);
    if (!owner || !owner.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: owner.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    if (owner.familyRole !== 'Patriarch') {
      return res.status(403).json({ success: false, message: 'Only the Patriarch can assign admins.' });
    }

    if (!targetUid) {
      return res.status(400).json({ success: false, message: 'Target user UID is required' });
    }

    const targetUser = await User.findOne({ uid: targetUid, familyId: owner.familyId });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User is not in your family.' });
    }

    if (targetUser.familyRole === 'Patriarch') {
      return res.status(400).json({ success: false, message: 'Cannot change the Patriarch role.' });
    }

    const maxSlots = family.maxAdminSlots;
    if (family.admins_list.length >= maxSlots) {
      return res.status(400).json({ success: false, message: `Admin slots full (max ${maxSlots} at level ${family.current_level}). Level up to unlock more slots.` });
    }

    const existingAdminIndex = family.admins_list.findIndex(a => a.uid === targetUid);
    const role = adminRole || 'admin';

    if (existingAdminIndex > -1) {
      family.admins_list[existingAdminIndex].role = role;
      family.admins_list[existingAdminIndex].assignedAt = new Date();
    } else {
      family.admins_list.push({ uid: targetUid, role, assignedAt: new Date() });
    }

    targetUser.familyRole = role === 'co_leader' ? 'co_leader' : role === 'elder' ? 'elder' : 'admin';
    await targetUser.save();
    await family.save();

    const io = getSocketIo();
    io.to(`family:${family.familyId}`).emit('family:admin_assigned', {
      familyId: family.familyId,
      uid: targetUid,
      role: role,
      username: targetUser.username || targetUser.displayName
    });

    res.status(200).json({ success: true, message: `${targetUser.username} is now ${role}!`, data: { admins_list: family.admins_list, maxAdminSlots: maxSlots } });
  } catch (error) {
    console.error('Assign Admin Error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign admin' });
  }
};

exports.removeAdmin = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUid } = req.body;

    const owner = await User.findById(userId);
    if (!owner || !owner.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: owner.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    if (owner.familyRole !== 'Patriarch') {
      return res.status(403).json({ success: false, message: 'Only the Patriarch can remove admins.' });
    }

    family.admins_list = family.admins_list.filter(a => a.uid !== targetUid);

    const targetUser = await User.findOne({ uid: targetUid, familyId: owner.familyId });
    if (targetUser) {
      targetUser.familyRole = 'Member';
      await targetUser.save();
    }

    await family.save();

    const io = getSocketIo();
    io.to(`family:${family.familyId}`).emit('family:admin_removed', {
      familyId: family.familyId,
      uid: targetUid
    });

    res.status(200).json({ success: true, message: 'Admin privileges removed.', data: { admins_list: family.admins_list } });
  } catch (error) {
    console.error('Remove Admin Error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove admin' });
  }
};

exports.getAdminList = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const adminUids = family.admins_list.map(a => a.uid);
    const adminUsers = await User.find({ uid: { $in: adminUids } })
      .select('uid username displayName avatar level familyRole')
      .lean();

    const enrichedAdmins = family.admins_list.map(admin => {
      const userInfo = adminUsers.find(u => u.uid === admin.uid);
      return {
        ...admin.toObject(),
        username: userInfo?.username || 'Unknown',
        displayName: userInfo?.displayName || '',
        avatar: userInfo?.avatar || '',
        level: userInfo?.level || 1
      };
    });

    res.status(200).json({
      success: true,
      data: {
        admins_list: enrichedAdmins,
        currentAdminCount: enrichedAdmins.length,
        maxAdminSlots: family.maxAdminSlots,
        currentLevel: family.current_level
      }
    });
  } catch (error) {
    console.error('Get Admin List Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get admin list' });
  }
};

exports.transferOwnership = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUid } = req.body;

    const owner = await User.findById(userId);
    if (!owner || !owner.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: owner.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    if (owner.familyRole !== 'Patriarch') {
      return res.status(403).json({ success: false, message: 'Only the Patriarch can transfer ownership.' });
    }

    if (!targetUid || targetUid === owner.uid) {
      return res.status(400).json({ success: false, message: 'Invalid target user.' });
    }

    const targetUser = await User.findOne({ uid: targetUid, familyId: owner.familyId });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User is not in your family.' });
    }

    family.creator_uid = targetUid;
    family.admins_list = family.admins_list.filter(a => a.uid !== owner.uid);
    family.admins_list.push({ uid: owner.uid, role: 'co_leader', assignedAt: new Date() });
    await family.save();

    owner.familyRole = 'co_leader';
    await owner.save();

    targetUser.familyRole = 'Patriarch';
    await targetUser.save();

    const io = getSocketIo();
    io.to(`family:${family.familyId}`).emit('family:ownership_transferred', {
      familyId: family.familyId,
      newPatriarchUid: targetUid,
      newPatriarchName: targetUser.username || targetUser.displayName
    });

    res.status(200).json({ success: true, message: `Ownership transferred to ${targetUser.username}!` });
  } catch (error) {
    console.error('Transfer Ownership Error:', error);
    res.status(500).json({ success: false, message: 'Failed to transfer ownership' });
  }
};

// ─── FAMILY TASKS ──────────────────────────────────────────────────────

exports.getFamilyTasks = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const tasks = await FamilyTask.find({ is_active: true, valid_from: { $lte: new Date() }, $or: [{ valid_until: null }, { valid_until: { $gte: new Date() } }] })
      .sort({ difficulty: -1 })
      .lean();

    const family = await Family.findOne({ familyId: user.familyId });

    const progressMap = {};
    if (family) {
      progressMap[family._id] = {
        total_xp: family.total_xp,
        total_gifts_sent: family.total_gifts_sent,
        total_wealth: family.total_wealth
      };
    }

    res.status(200).json({ success: true, data: tasks, progress: progressMap });
  } catch (error) {
    console.error('Get Family Tasks Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get family tasks' });
  }
};

exports.getTaskProgress = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId }).select('familyId total_xp total_gifts_sent total_wealth current_level');
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const tasks = await FamilyTask.find({ is_active: true }).lean();

    res.status(200).json({
      success: true,
      data: {
        familyId: family.familyId,
        currentLevel: family.current_level,
        totalXp: family.total_xp,
        totalGiftsSent: family.total_gifts_sent,
        totalWealth: family.total_wealth,
        tasks: tasks.map(task => ({
          taskId: task._id,
          title: task.title,
          targetValue: task.target_value,
          rewardCoins: task.reward_coins,
          rewardPoints: task.reward_points,
          rewardXp: task.reward_xp
        }))
      }
    });
  } catch (error) {
    console.error('Get Task Progress Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get task progress' });
  }
};

exports.submitTaskProgress = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const { taskId, progress } = req.body;
    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const task = await FamilyTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.is_active) {
      return res.status(400).json({ success: false, message: 'Task is not active' });
    }

    const progressKey = `task_progress.${taskId}`;
    family.set(progressKey, progress);
    await family.save();

    res.status(200).json({ success: true, message: 'Task progress submitted', data: { taskId, currentProgress: progress } });
  } catch (error) {
    console.error('Submit Task Progress Error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit task progress' });
  }
};

exports.claimTaskRewards = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const { taskId } = req.body;
    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const task = await FamilyTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const familyProgress = family.get(`task_progress.${taskId}`) || 0;
    if (familyProgress < task.target_value) {
      return res.status(400).json({ success: false, message: 'Task not completed yet. Keep going!' });
    }

    family.family_points += (task.reward_points || 0);
    family.coins = (family.coins || 0) + (task.reward_coins || 0);
    family.total_xp += (task.reward_xp || 0);

    await family.save();
    await checkAndUpgradeFamilyLevel(family);

    res.status(200).json({ success: true, message: 'Task rewards claimed!', data: { familyPoints: family.family_points, totalXp: family.total_xp, currentLevel: family.current_level } });
  } catch (error) {
    console.error('Claim Task Rewards Error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim task rewards' });
  }
};

// ─── FAMILY SHOP ───────────────────────────────────────────────────────

exports.getFamilyShopItems = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const items = await FamilyShopItem.find({ is_active: true })
      .sort({ cost_family_points: 1 })
      .lean();

    const family = await Family.findOne({ familyId: user.familyId });
    const inventory = family ? family.family_inventory || [] : [];

    const itemsWithStatus = items.map(item => ({
      ...item,
      isOwned: inventory.some(inv => inv.itemId === item.itemId),
      isEquipped: inventory.some(inv => inv.itemId === item.itemId && inv.equippedBy === user.uid)
    }));

    res.status(200).json({ success: true, data: itemsWithStatus });
  } catch (error) {
    console.error('Get Family Shop Items Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get shop items' });
  }
};

exports.purchaseFamilyShopItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const { itemId } = req.body;
    const item = await FamilyShopItem.findOne({ itemId, is_active: true });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    if (family.family_points < item.cost_family_points) {
      return res.status(400).json({ success: false, message: 'Insufficient family points' });
    }

    const existingItem = family.family_inventory.find(inv => inv.itemId === itemId);
    if (existingItem) {
      return res.status(400).json({ success: false, message: 'Item already purchased' });
    }

    family.family_points -= item.cost_family_points;
    family.family_inventory.push({
      itemId: item.itemId,
      itemType: item.item_type,
      equippedBy: null,
      acquiredAt: new Date()
    });
    await family.save();

    res.status(200).json({ success: true, message: 'Item purchased successfully!', data: { familyPoints: family.family_points } });
  } catch (error) {
    console.error('Purchase Family Shop Item Error:', error);
    res.status(500).json({ success: false, message: 'Failed to purchase item' });
  }
};

exports.getFamilyInventory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId }).select('family_inventory');
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const inventory = await FamilyShopItem.find({ 'itemId': { $in: family.family_inventory.map(inv => inv.itemId) } }).lean();

    const enrichedInventory = family.family_inventory.map(inv => {
      const item = inventory.find(i => i.itemId === inv.itemId);
      return {
        ...inv,
        item,
        isEquippedByMe: inv.equippedBy === user.uid
      };
    });

    res.status(200).json({ success: true, data: enrichedInventory });
  } catch (error) {
    console.error('Get Family Inventory Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get family inventory' });
  }
};

// ─── FAMILY CHAT ───────────────────────────────────────────────────────

exports.getFamilyChatMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const { page = 1, limit = 50 } = req.query;
    const messages = await FamilyChat.find({ familyId: user.familyId, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({ success: true, data: messages.reverse() });
  } catch (error) {
    console.error('Get Family Chat Messages Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get chat messages' });
  }
};

exports.sendFamilyChatMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { familyId, messageType, content, replyTo, attachments } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const newMessage = new FamilyChat({
      familyId: user.familyId,
      senderUid: user.uid,
      senderName: user.displayName || user.username,
      senderAvatar: user.avatar || '',
      messageType: messageType || 'text',
      content,
      replyTo: replyTo || null,
      attachments: attachments || []
    });

    await newMessage.save();

    const populatedMessage = await FamilyChat.findById(newMessage._id).lean();

    res.status(201).json({ success: true, message: 'Message sent', data: populatedMessage });
  } catch (error) {
    console.error('Send Family Chat Message Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

exports.deleteFamilyChatMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.body;

    const message = await FamilyChat.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const user = await User.findOne({ uid: message.senderUid });
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'Unauthorized' });
    }

    if (message.senderUid !== userId) {
      const actor = await User.findById(userId);
      if (!actor || (actor.familyRole !== 'Patriarch' && actor.familyRole !== 'co_leader')) {
        return res.status(403).json({ success: false, message: 'You cannot delete this message' });
      }
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.status(200).json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('Delete Family Chat Message Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
};

exports.pinFamilyChatMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    if (user.familyRole !== 'Patriarch' && user.familyRole !== 'co_leader') {
      return res.status(403).json({ success: false, message: 'Only leaders can pin messages' });
    }

    const message = await FamilyChat.findOne({ _id: messageId, familyId: user.familyId });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    message.isPinned = !message.isPinned;
    await message.save();

    res.status(200).json({ success: true, message: message.isPinned ? 'Message pinned' : 'Message unpinned', data: message });
  } catch (error) {
    console.error('Pin Family Chat Message Error:', error);
    res.status(500).json({ success: false, message: 'Failed to pin message' });
  }
};

exports.addChatReaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId, emoji } = req.body;

    const message = await FamilyChat.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const user = await User.findOne({ uid: userId });
    if (!user || !user.familyId || user.familyId !== message.familyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const existingReactionIndex = message.reactions.findIndex(r => r.uid === userId);
    if (existingReactionIndex > -1) {
      message.reactions[existingReactionIndex].emoji = emoji;
      message.reactions[existingReactionIndex].reactedAt = new Date();
    } else {
      message.reactions.push({ uid: userId, emoji, reactedAt: new Date() });
    }

    await message.save();
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    console.error('Add Chat Reaction Error:', error);
    res.status(500).json({ success: false, message: 'Failed to add reaction' });
  }
};

// ─── FAMILY PK BATTLES ─────────────────────────────────────────────────

exports.createFamilyPK = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetFamilyId, roomId, hostUid, durationMinutes } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    if (user.familyRole !== 'Patriarch' && user.familyRole !== 'co_leader' && user.familyRole !== 'elder') {
      return res.status(403).json({ success: false, message: 'Only leaders can initiate family PK battles' });
    }

    const myFamily = await Family.findOne({ familyId: user.familyId });
    const targetFamily = await Family.findOne({ familyId: targetFamilyId, is_active: true });

    if (!myFamily || !targetFamily) {
      return res.status(404).json({ success: false, message: 'One or both families not found' });
    }

    const battle = new FamilyPK({
      family1Id: myFamily.familyId,
      family2Id: targetFamilyId,
      family1Name: myFamily.family_name,
      family2Name: targetFamily.family_name,
      family1Badge: myFamily.family_badge,
      family2Badge: targetFamily.family_badge,
      host1Uid: hostUid || userId,
      host2Uid: null,
      roomId: roomId,
      durationMinutes: durationMinutes || 3,
      host1Score: 0,
      host2Score: 0,
      status: 'pending',
      startedAt: null,
      endedAt: null
    });

    await battle.save();

    res.status(201).json({ success: true, message: 'Family PK battle created!', data: battle });
  } catch (error) {
    console.error('Create Family PK Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create family PK' });
  }
};

exports.joinFamilyPK = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { battleId, asHost } = req.body;

    const battle = await FamilyPK.findById(battleId);
    if (!battle) {
      return res.status(404).json({ success: false, message: 'Battle not found' });
    }

    if (battle.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Battle is not in pending state' });
    }

    const user = await User.findById(userId);
    const targetFamilyId = user.familyId === battle.family1Id ? battle.family2Id : battle.family1Id;

    if (!targetFamilyId) {
      return res.status(400).json({ success: false, message: 'You are not in a family participating in this battle' });
    }

    if (asHost) {
      battle.host2Uid = user.uid;
      battle.host2Name = user.displayName || user.username;
      battle.host2Avatar = user.avatar || '';
    }

    battle.status = 'live';
    battle.startedAt = new Date();
    battle.endedAt = new Date(Date.now() + battle.durationMinutes * 60000);

    await battle.save();

    res.status(200).json({ success: true, message: 'Joined PK battle!', data: battle });
  } catch (error) {
    console.error('Join Family PK Error:', error);
    res.status(500).json({ success: false, message: 'Failed to join PK battle' });
  }
};

exports.getActiveFamilyPK = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const battle = await FamilyPK.findOne({
      $or: [{ family1Id: user.familyId }, { family2Id: user.familyId }],
      status: 'live'
    }).sort({ startedAt: -1 }).lean();

    res.status(200).json({ success: true, data: battle });
  } catch (error) {
    console.error('Get Active Family PK Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get active PK' });
  }
};

exports.getFamilyPKHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const battles = await FamilyPK.find({
      $or: [{ family1Id: user.familyId }, { family2Id: user.familyId }],
      status: { $in: ['live', 'finished'] }
    })
      .sort({ startedAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({ success: true, data: battles });
  } catch (error) {
    console.error('Get Family PK History Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get PK history' });
  }
};

exports.getFamilyPKDetail = async (req, res) => {
  try {
    const { battleId } = req.params;
    const battle = await FamilyPK.findById(battleId).lean();

    if (!battle) {
      return res.status(404).json({ success: false, message: 'Battle not found' });
    }

    res.status(200).json({ success: true, data: battle });
  } catch (error) {
    console.error('Get Family PK Detail Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get battle details' });
  }
};

exports.updateFamilyPKScore = async (req, res) => {
  try {
    const { battleId, familyId, score } = req.body;
    const battle = await FamilyPK.findById(battleId);
    if (!battle) {
      return res.status(404).json({ success: false, message: 'Battle not found' });
    }

    if (battle.family1Id === familyId) {
      battle.host1Score = (battle.host1Score || 0) + score;
    } else if (battle.family2Id === familyId) {
      battle.host2Score = (battle.host2Score || 0) + score;
    } else {
      return res.status(403).json({ success: false, message: 'Your family is not in this battle' });
    }

    await battle.save();
    res.status(200).json({ success: true, data: battle });
  } catch (error) {
    console.error('Update Family PK Score Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update score' });
  }
};

// ─── FAMILY WARS ───────────────────────────────────────────────────────

exports.getActiveFamilyWars = async (req, res) => {
  try {
    const wars = await FamilyWar.find({
      status: { $in: ['upcoming', 'live'] },
      $or: [{ isGlobal: true }, { participants: { $exists: true } }]
    })
      .sort({ startTime: -1 })
      .limit(20)
      .lean();

    res.status(200).json({ success: true, data: wars });
  } catch (error) {
    console.error('Get Active Family Wars Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get active wars' });
  }
};

exports.getFamilyWarHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const wars = await FamilyWar.find({
      $or: [{ createdBy: user.familyId }, { participants: user.familyId }],
      status: 'finished'
    })
      .sort({ endTime: -1 })
      .limit(50)
      .lean();

    res.status(200).json({ success: true, data: wars });
  } catch (error) {
    console.error('Get Family War History Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get war history' });
  }
};

exports.registerForFamilyWar = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { warId } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const war = await FamilyWar.findById(warId);
    if (!war) {
      return res.status(404).json({ success: false, message: 'War not found' });
    }

    if (war.status !== 'upcoming' && war.status !== 'live') {
      return res.status(400).json({ success: false, message: 'War registration is closed' });
    }

    if (!war.participants.includes(user.familyId)) {
      war.participants.push(user.familyId);
      await war.save();
    }

    res.status(200).json({ success: true, message: 'Registered for war successfully!', data: war });
  } catch (error) {
    console.error('Register For Family War Error:', error);
    res.status(500).json({ success: false, message: 'Failed to register for war' });
  }
};

exports.getWarLeaderboard = async (req, res) => {
  try {
    const { warId } = req.params;
    const war = await FamilyWar.findById(warId);
    if (!war) {
      return res.status(404).json({ success: false, message: 'War not found' });
    }

    let familyScores = war.familyScores || [];
    familyScores.sort((a, b) => b.score - a.score);

    res.status(200).json({ success: true, data: familyScores, warId });
  } catch (error) {
    console.error('Get War Leaderboard Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get leaderboard' });
  }
};

exports.getMyWarContribution = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const { warId } = req.params;
    const war = await FamilyWar.findById(warId);
    if (!war) {
      return res.status(404).json({ success: false, message: 'War not found' });
    }

    const userContribution = war.individualContributions?.find(c => c.uid === user.uid) || { uid: user.uid, username: user.username, contributionScore: 0 };

    res.status(200).json({ success: true, data: { ...userContribution, familyId: user.familyId, warId } });
  } catch (error) {
    console.error('Get My War Contribution Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get contribution' });
  }
};

exports.updateWarScore = async (req, res) => {
  try {
    const { warId, familyId, uid, contributionScore, giftValue } = req.body;

    const war = await FamilyWar.findById(warId);
    if (!war || (war.status !== 'live' && war.status !== 'upcoming')) {
      return res.status(400).json({ success: false, message: 'War is not active' });
    }

    if (!war.participants.includes(familyId)) {
      return res.status(403).json({ success: false, message: 'Your family is not registered for this war' });
    }

    if (!war.familyScores) war.familyScores = [];
    if (!war.individualContributions) war.individualContributions = [];

    const famIndex = war.familyScores.findIndex(f => f.familyId === familyId);
    if (famIndex > -1) {
      war.familyScores[famIndex].score += contributionScore;
    } else {
      war.familyScores.push({ familyId, score: contributionScore });
    }

    const indIndex = war.individualContributions.findIndex(c => c.uid === uid);
    if (indIndex > -1) {
      war.individualContributions[indIndex].contributionScore += contributionScore;
    } else {
      war.individualContributions.push({ uid, contributionScore });
    }

    await war.save();
    res.status(200).json({ success: true, data: war });
  } catch (error) {
    console.error('Update War Score Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update war score' });
  }
};

// ─── FAMILY RANKINGS & LEADERBOARD ─────────────────────────────────────

exports.getFamilyLeaderboard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const { period = 'all_time', page = 1, limit = 50 } = req.query;

    const leaderboard = await FamilyLeaderboard.find({
      familyId: user.familyId,
      period: period
    })
      .sort({ rank: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await FamilyLeaderboard.countDocuments({
      familyId: user.familyId,
      period: period
    });

    const top3 = leaderboard.filter(m => m.rank <= 3);

    res.status(200).json({
      success: true,
      data: {
        leaderboard,
        top3,
        total: totalCount,
        page: parseInt(page),
        period: period
      }
    });
  } catch (error) {
    console.error('Get Family Leaderboard Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get leaderboard' });
  }
};

exports.updateLeaderboard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const members = await User.find({ familyId: family.familyId, isActive: true })
      .select('uid username avatar coins totalGiftsSent familyContribution xp level')
      .lean();

    for (const member of members) {
      const totalContribution = (member.familyContribution || 0) + (member.totalGiftsSent || 0);
      await FamilyLeaderboard.findOneAndUpdate(
        { familyId: family.familyId, uid: member.uid, period: 'all_time' },
        {
          $set: {
            username: member.username || '',
            avatar: member.avatar || '',
            totalContribution: totalContribution,
            totalCoinsGifted: member.totalGiftsSent || 0,
            totalXPEarned: member.xp || 0,
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
    }

    const allEntries = await FamilyLeaderboard.find({ familyId: family.familyId, period: 'all_time' })
      .sort({ totalContribution: -1 })
      .lean();

    for (let i = 0; i < allEntries.length; i++) {
      await FamilyLeaderboard.findOneAndUpdate(
        { _id: allEntries[i]._id },
        { $set: { rank: i + 1 } }
      );
    }

    res.status(200).json({ success: true, message: 'Leaderboard updated!' });
  } catch (error) {
    console.error('Update Leaderboard Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update leaderboard' });
  }
};

exports.getDailyFamilyRankings = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rankings = await Ranking.find({ type: 'family', period: 'daily', createdAt: { $gte: today } })
      .sort({ rank: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({ success: true, data: rankings });
  } catch (error) {
    console.error('Get Daily Family Rankings Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get rankings' });
  }
};

exports.getWeeklyFamilyRankings = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const rankings = await Ranking.find({ type: 'family', period: 'weekly', createdAt: { $gte: weekStart } })
      .sort({ rank: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({ success: true, data: rankings });
  } catch (error) {
    console.error('Get Weekly Family Rankings Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get rankings' });
  }
};

exports.getMonthlyFamilyRankings = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const rankings = await Ranking.find({ type: 'family', period: 'monthly', createdAt: { $gte: monthStart } })
      .sort({ rank: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({ success: true, data: rankings });
  } catch (error) {
    console.error('Get Monthly Family Rankings Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get rankings' });
  }
};

// ─── FAMILY STAY REWARD (ROOM REWARD) ──────────────────────────────────

exports.startStaySession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { roomId, seatIndex } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const existingSession = await FamilyStayReward.findOne({
      uid: user.uid,
      familyId: user.familyId,
      isActive: true
    });

    if (existingSession) {
      return res.status(400).json({ success: false, message: 'You already have an active stay session.' });
    }

    const session = new FamilyStayReward({
      familyId: user.familyId,
      uid: user.uid,
      roomId: roomId || family.official_room_id,
      seatIndex: seatIndex || 0,
      sessionStart: new Date(),
      rewardInterval: 5,
      lastRewardAt: new Date(),
      isActive: true
    });

    await session.save();

    res.status(201).json({ success: true, message: 'Stay session started!', data: session });
  } catch (error) {
    console.error('Start Stay Session Error:', error);
    res.status(500).json({ success: false, message: 'Failed to start stay session' });
  }
};

exports.redeemStayReward = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const session = await FamilyStayReward.findOne({
      uid: user.uid,
      familyId: user.familyId,
      isActive: true
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'No active stay session found. Start a session first.' });
    }

    const now = new Date();
    const elapsedMinutes = (now.getTime() - session.lastRewardAt.getTime()) / 60000;

    if (elapsedMinutes < session.rewardInterval) {
      const remainingMinutes = (session.rewardInterval - elapsedMinutes).toFixed(1);
      return res.status(400).json({ success: false, message: `Wait ${remainingMinutes} minutes for next reward.` });
    }

    const intervalsEarned = Math.floor(elapsedMinutes / session.rewardInterval);
    const coinsPerInterval = family.reward_config.stay_reward_coins_per_5min || 10;
    const xpPerInterval = family.reward_config.stay_reward_xp_per_5min || 5;

    const coinsEarned = coinsPerInterval * intervalsEarned;
    const xpEarned = xpPerInterval * intervalsEarned;

    session.coinsEarned += coinsEarned;
    session.xpEarned += xpEarned;
    session.durationMinutes += session.rewardInterval * intervalsEarned;
    session.lastRewardAt = now;
    await session.save();

    user.coins = (user.coins || 0) + coinsEarned;
    user.xp = (user.xp || 0) + xpEarned;
    user.familyContribution = (user.familyContribution || 0) + coinsEarned;
    await user.save();

    family.total_xp = (family.total_xp || 0) + xpEarned;
    family.totalWealth = (family.totalWealth || 0) + coinsEarned;
    await family.save();
    await checkAndUpgradeFamilyLevel(family);

    await updateLeaderboardForMember(family.familyId, user);

    res.status(200).json({
      success: true,
      message: `Reward redeemed! +${coinsEarned} coins & +${xpEarned} XP`,
      data: {
        coinsEarned,
        xpEarned,
        totalDurationMinutes: session.durationMinutes,
        totalCoinsEarned: session.coinsEarned,
        totalXpEarned: session.xpEarned
      }
    });
  } catch (error) {
    console.error('Redeem Stay Reward Error:', error);
    res.status(500).json({ success: false, message: 'Failed to redeem stay reward' });
  }
};

exports.endStaySession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const session = await FamilyStayReward.findOne({
      uid: user.uid,
      familyId: user.familyId,
      isActive: true
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'No active stay session.' });
    }

    session.isActive = false;
    session.sessionEnd = new Date();
    const totalMinutes = (session.sessionEnd.getTime() - session.sessionStart.getTime()) / 60000;
    session.durationMinutes = Math.round(totalMinutes);
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Stay session ended.',
      data: {
        durationMinutes: session.durationMinutes,
        totalCoinsEarned: session.coinsEarned,
        totalXpEarned: session.xpEarned
      }
    });
  } catch (error) {
    console.error('End Stay Session Error:', error);
    res.status(500).json({ success: false, message: 'Failed to end stay session' });
  }
};

exports.getMyStaySession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const session = await FamilyStayReward.findOne({
      uid: user.uid,
      familyId: user.familyId,
      isActive: true
    }).lean();

    const history = await FamilyStayReward.find({
      uid: user.uid,
      familyId: user.familyId
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.status(200).json({ success: true, data: { activeSession: session, history } });
  } catch (error) {
    console.error('Get My Stay Session Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stay session' });
  }
};

// ─── FAMILY REWARD CONFIG (OWNER PANEL) ────────────────────────────────

exports.getRewardConfig = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId }).select('reward_config');
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    res.status(200).json({ success: true, data: family.reward_config });
  } catch (error) {
    console.error('Get Reward Config Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get reward config' });
  }
};

exports.updateRewardConfig = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    if (user.familyRole !== 'Patriarch') {
      return res.status(403).json({ success: false, message: 'Only the Patriarch can update reward configuration.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const {
      top1_reward,
      top2_reward,
      top3_reward,
      stay_reward_coins_per_5min,
      stay_reward_xp_per_5min,
      custom_rewards_enabled
    } = req.body;

    if (top1_reward !== undefined) family.reward_config.top1_reward = top1_reward;
    if (top2_reward !== undefined) family.reward_config.top2_reward = top2_reward;
    if (top3_reward !== undefined) family.reward_config.top3_reward = top3_reward;
    if (stay_reward_coins_per_5min !== undefined) family.reward_config.stay_reward_coins_per_5min = Math.max(1, Math.min(100, stay_reward_coins_per_5min));
    if (stay_reward_xp_per_5min !== undefined) family.reward_config.stay_reward_xp_per_5min = Math.max(1, Math.min(50, stay_reward_xp_per_5min));
    if (custom_rewards_enabled !== undefined) family.reward_config.custom_rewards_enabled = custom_rewards_enabled;

    await family.save();

    res.status(200).json({ success: true, message: 'Reward configuration updated!', data: family.reward_config });
  } catch (error) {
    console.error('Update Reward Config Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update reward config' });
  }
};

// ─── SET OFFICIAL ROOM ─────────────────────────────────────────────────

exports.setOfficialRoom = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { roomId } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    if (user.familyRole !== 'Patriarch' && user.familyRole !== 'co_leader') {
      return res.status(403).json({ success: false, message: 'Only Patriarch and Co-leaders can set the official room.' });
    }

    family.official_room_id = roomId;
    await family.save();

    const io = getSocketIo();
    io.to(`family:${family.familyId}`).emit('family:official_room_updated', {
      familyId: family.familyId,
      official_room_id: roomId
    });

    res.status(200).json({ success: true, message: 'Official room set!', data: { official_room_id: roomId } });
  } catch (error) {
    console.error('Set Official Room Error:', error);
    res.status(500).json({ success: false, message: 'Failed to set official room' });
  }
};

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────

async function checkAndUpgradeFamilyLevel(family) {
  const xpThresholds = [0, 100, 300, 700, 1200, 1800, 2500, 3300, 4200, 5200, 6300, 7500, 8800, 10200, 11700, 13300];
  const memberLimits = [20, 30, 40, 50, 60, 70, 80, 90, 100, 100, 100, 100, 100, 100, 100, 100];

  let newLevel = 1;
  for (let i = xpThresholds.length - 1; i >= 0; i--) {
    if (family.total_xp >= xpThresholds[i]) {
      newLevel = i + 1;
      break;
    }
  }

  if (newLevel > family.current_level) {
    family.current_level = newLevel;
    if (memberLimits[newLevel - 1]) {
      family.member_limit = memberLimits[newLevel - 1];
    }
    family.unlocked_powers = getPowersForLevel(newLevel);
    await family.save();

    const io = getSocketIo();
    io.to(`family:${family.familyId}`).emit('family:level_up', {
      familyId: family.familyId,
      newLevel: newLevel,
      unlocked_powers: family.unlocked_powers
    });
  }
}

function getPowersForLevel(level) {
  const powers = {
    1: ['basic_chat'],
    2: ['basic_chat', 'family_shop'],
    3: ['basic_chat', 'family_shop', 'family_badge_custom'],
    4: ['basic_chat', 'family_shop', 'family_badge_custom', 'family_emoji'],
    5: ['basic_chat', 'family_shop', 'family_badge_custom', 'family_emoji', 'family_pk'],
    6: ['basic_chat', 'family_shop', 'family_badge_custom', 'family_emoji', 'family_pk', 'family_tag'],
    7: ['basic_chat', 'family_shop', 'family_badge_custom', 'family_emoji', 'family_pk', 'family_tag', 'custom_role'],
    8: ['basic_chat', 'family_shop', 'family_badge_custom', 'family_emoji', 'family_pk', 'family_tag', 'custom_role', 'advanced_shop'],
    9: ['basic_chat', 'family_shop', 'family_badge_custom', 'family_emoji', 'family_pk', 'family_tag', 'custom_role', 'advanced_shop', 'family_war'],
    10: ['basic_chat', 'family_shop', 'family_badge_custom', 'family_emoji', 'family_pk', 'family_tag', 'custom_role', 'advanced_shop', 'family_war', 'vip_discount']
  };

  return powers[level] || powers[10];
}

async function updateLeaderboardForMember(familyId, user) {
  try {
    const totalContribution = (user.familyContribution || 0) + (user.totalGiftsSent || 0);
    const existing = await FamilyLeaderboard.findOne({
      familyId: familyId,
      uid: user.uid,
      period: 'all_time'
    });

    if (existing) {
      existing.totalContribution = totalContribution;
      existing.totalCoinsGifted = user.totalGiftsSent || 0;
      existing.totalXPEarned = user.xp || 0;
      existing.username = user.username || '';
      existing.avatar = user.avatar || '';
      existing.lastUpdated = new Date();
      await existing.save();
    } else {
      await new FamilyLeaderboard({
        familyId: familyId,
        uid: user.uid,
        username: user.username || '',
        avatar: user.avatar || '',
        totalContribution: totalContribution,
        totalCoinsGifted: user.totalGiftsSent || 0,
        totalXPEarned: user.xp || 0,
        rank: 999,
        period: 'all_time'
      }).save();
    }

    const allEntries = await FamilyLeaderboard.find({ familyId: familyId, period: 'all_time' })
      .sort({ totalContribution: -1 })
      .lean();

    for (let i = 0; i < allEntries.length; i++) {
      await FamilyLeaderboard.findOneAndUpdate(
        { _id: allEntries[i]._id },
        { $set: { rank: i + 1 } }
      );
    }
  } catch (error) {
    console.error('Update Leaderboard For Member Error:', error);
  }
}

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────

exports.adminGetAllFamilies = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const query = search ? { family_name: new RegExp(search, 'i') } : {};
    const isActiveFilter = req.query.isActive;
    if (isActiveFilter !== undefined) {
      query.is_active = isActiveFilter === 'true';
    }

    const families = await Family.find(query)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await Family.countDocuments(query);

    res.status(200).json({ success: true, data: families, total: totalCount, page: parseInt(page) });
  } catch (error) {
    console.error('Admin Get All Families Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch families' });
  }
};

exports.adminToggleFamilyStatus = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { isActive } = req.body;

    const family = await Family.findOne({ familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    family.is_active = isActive;
    await family.save();

    res.status(200).json({ success: true, message: `Family ${isActive ? 'activated' : 'deactivated'} successfully`, data: family });
  } catch (error) {
    console.error('Admin Toggle Family Status Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update family status' });
  }
};

exports.adminBanFamily = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { reason } = req.body;

    const family = await Family.findOne({ familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    family.is_banned = true;
    family.ban_reason = reason || 'Violation of community guidelines';
    family.banned_at = new Date();
    family.banned_by = req.user.userId;
    await family.save();

    await User.updateMany({ familyId: family.familyId }, { $unset: { familyId: '', familyRole: '', family: '' } });

    res.status(200).json({ success: true, message: 'Family banned successfully' });
  } catch (error) {
    console.error('Admin Ban Family Error:', error);
    res.status(500).json({ success: false, message: 'Failed to ban family' });
  }
};

exports.adminUnbanFamily = async (req, res) => {
  try {
    const { familyId } = req.params;

    const family = await Family.findOne({ familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    family.is_banned = false;
    family.ban_reason = null;
    family.banned_at = null;
    family.banned_by = null;
    await family.save();

    res.status(200).json({ success: true, message: 'Family unbanned successfully' });
  } catch (error) {
    console.error('Admin Unban Family Error:', error);
    res.status(500).json({ success: false, message: 'Failed to unban family' });
  }
};

exports.adminDeleteFamily = async (req, res) => {
  try {
    const { familyId } = req.params;

    const family = await Family.findOne({ familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    await User.updateMany({ familyId: family.familyId }, { $unset: { familyId: '', familyRole: '', family: '' } });

    await Family.deleteOne({ familyId });

    res.status(200).json({ success: true, message: 'Family deleted permanently' });
  } catch (error) {
    console.error('Admin Delete Family Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete family' });
  }
};