const User = require('../models/User');
const Notification = require('../models/Notification');
const VisitorHistory = require('../models/VisitorHistory');

// ─────────────────────────────────────────────────────────────────────────
// FOLLOW USER
// POST /api/social/follow/:userId
// ─────────────────────────────────────────────────────────────────────────
exports.followUser = async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user.userId;
    const { userId } = req.params;

    if (userId === requestingUserId) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentUser = await User.findById(requestingUserId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'Current user not found' });
    }

    if (currentUser.following.includes(userId)) {
      return res.status(400).json({ success: false, message: 'Already following this user' });
    }

    currentUser.following.push(userId);
    currentUser.followingCount = currentUser.following.length;

    if (!targetUser.followers.includes(requestingUserId)) {
      targetUser.followers.push(requestingUserId);
      targetUser.followersCount = targetUser.followers.length;
    }

    await currentUser.save();
    await targetUser.save();

    await Notification.create({
      userId: userId,
      type: 'follow',
      title: 'New Follower',
      body: `${currentUser.name || 'Someone'} started following you.`,
      data: {
        followerId: requestingUserId,
        followerName: currentUser.name,
        followerAvatar: currentUser.avatar
      }
    });

    res.status(200).json({
      success: true,
      message: 'User followed successfully',
      data: {
        followersCount: targetUser.followersCount,
        followingCount: currentUser.followingCount
      }
    });
  } catch (error) {
    console.error('Follow User Error:', error);
    res.status(500).json({ success: false, message: 'Failed to follow user' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// UNFOLLOW USER
// POST /api/social/unfollow/:userId
// ─────────────────────────────────────────────────────────────────────────
exports.unfollowUser = async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user.userId;
    const { userId } = req.params;

    if (userId === requestingUserId) {
      return res.status(400).json({ success: false, message: 'Cannot unfollow yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentUser = await User.findById(requestingUserId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'Current user not found' });
    }

    currentUser.following = currentUser.following.filter(id => id.toString() !== userId);
    currentUser.followingCount = currentUser.following.length;

    targetUser.followers = targetUser.followers.filter(id => id.toString() !== requestingUserId);
    targetUser.followersCount = targetUser.followers.length;

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: 'User unfollowed successfully',
      data: {
        followersCount: targetUser.followersCount,
        followingCount: currentUser.followingCount
      }
    });
  } catch (error) {
    console.error('Unfollow User Error:', error);
    res.status(500).json({ success: false, message: 'Failed to unfollow user' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET USER'S FOLLOWERS LIST
// GET /api/social/followers/:userId
// ─────────────────────────────────────────────────────────────────────────
exports.getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id || req.user.userId;

    const user = await User.findById(userId)
      .populate('followers', 'name avatar uid arvindId level isVip vipLevel')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const followers = (user.followers || []).map(follower => {
      if (!follower || typeof follower !== 'object') return null;
      return {
        _id: follower._id,
        name: follower.name || 'User',
        avatar: follower.avatar,
        uid: follower.uid,
        arvindId: follower.arvindId,
        level: follower.level || 1,
        isVip: follower.isVip || false,
        vipLevel: follower.vipLevel || 0
      };
    }).filter(Boolean);

    res.status(200).json({
      success: true,
      data: followers,
      count: followers.length
    });
  } catch (error) {
    console.error('Get Followers Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch followers' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET USER'S FOLLOWING LIST
// GET /api/social/following/:userId
// ─────────────────────────────────────────────────────────────────────────
exports.getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id || req.user.userId;

    const user = await User.findById(userId)
      .populate('following', 'name avatar uid arvindId level isVip vipLevel')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const following = (user.following || []).map(followedUser => {
      if (!followedUser || typeof followedUser !== 'object') return null;
      return {
        _id: followedUser._id,
        name: followedUser.name || 'User',
        avatar: followedUser.avatar,
        uid: followedUser.uid,
        arvindId: followedUser.arvindId,
        level: followedUser.level || 1,
        isVip: followedUser.isVip || false,
        vipLevel: followedUser.vipLevel || 0
      };
    }).filter(Boolean);

    res.status(200).json({
      success: true,
      data: following,
      count: following.length
    });
  } catch (error) {
    console.error('Get Following Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch following list' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// RECORD VISITOR HISTORY
// POST /api/social/visit/:userId
// ─────────────────────────────────────────────────────────────────────────
exports.recordVisit = async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user.userId;
    const { userId } = req.params;

    if (userId === requestingUserId) {
      return res.status(400).json({ success: false, message: 'Cannot visit your own profile' });
    }

    const profileUser = await User.findById(userId);
    if (!profileUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const visitorUser = await User.findById(requestingUserId);
    if (!visitorUser) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    const existingVisit = await VisitorHistory.findOneAndUpdate(
      { profileUserId: userId, visitorId: requestingUserId },
      {
        visitorUid: visitorUser.uid,
        visitorName: visitorUser.name || visitorUser.displayName || 'Anonymous',
        visitorAvatar: visitorUser.avatar || '',
        visitedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Visit recorded',
      data: existingVisit
    });
  } catch (error) {
    console.error('Record Visit Error:', error);
    res.status(500).json({ success: false, message: 'Failed to record visit' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET VISITOR HISTORY
// GET /api/social/visitors
// ─────────────────────────────────────────────────────────────────────────
exports.getVisitorHistory = async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user.userId;

    const user = await User.findById(requestingUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const visitors = await VisitorHistory.find({ profileUserId: requestingUserId })
      .sort({ visitedAt: -1 })
      .limit(100);

    const visitorList = visitors.map(visit => ({
      _id: visit._id,
      visitorId: visit.visitorId,
      visitorUid: visit.visitorUid,
      visitorName: visit.visitorName,
      visitorAvatar: visit.visitorAvatar,
      visitedAt: visit.visitedAt
    }));

    res.status(200).json({
      success: true,
      data: visitorList,
      count: visitorList.length
    });
  } catch (error) {
    console.error('Get Visitor History Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch visitor history' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// BLOCK USER
// POST /api/social/block/:userId
// ─────────────────────────────────────────────────────────────────────────
exports.blockUser = async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user.userId;
    const { userId } = req.params;

    if (userId === requestingUserId) {
      return res.status(400).json({ success: false, message: 'Cannot block yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentUser = await User.findById(requestingUserId);

    if (currentUser.blockList.includes(userId)) {
      return res.status(400).json({ success: false, message: 'User already blocked' });
    }

    currentUser.blockList.push(userId);
    currentUser.blockedCount = currentUser.blockList.length;

    if (currentUser.following.includes(userId)) {
      currentUser.following = currentUser.following.filter(id => id.toString() !== userId);
      currentUser.followingCount = currentUser.following.length;
    }

    if (currentUser.followers.includes(userId)) {
      currentUser.followers = currentUser.followers.filter(id => id.toString() !== userId);
      currentUser.followersCount = currentUser.followers.length;
    }

    await currentUser.save();

    res.status(200).json({
      success: true,
      message: 'User blocked successfully',
      blockedCount: currentUser.blockedCount
    });
  } catch (error) {
    console.error('Block User Error:', error);
    res.status(500).json({ success: false, message: 'Failed to block user' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// UNBLOCK USER
// POST /api/social/unblock/:userId
// ─────────────────────────────────────────────────────────────────────────
exports.unblockUser = async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user.userId;
    const { userId } = req.params;

    const currentUser = await User.findById(requestingUserId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!currentUser.blockList.includes(userId)) {
      return res.status(400).json({ success: false, message: 'User is not blocked' });
    }

    currentUser.blockList = currentUser.blockList.filter(id => id.toString() !== userId);
    currentUser.blockedCount = currentUser.blockList.length;
    await currentUser.save();

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
      blockedCount: currentUser.blockedCount
    });
  } catch (error) {
    console.error('Unblock User Error:', error);
    res.status(500).json({ success: false, message: 'Failed to unblock user' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET BLOCK LIST
// GET /api/social/block-list
// ─────────────────────────────────────────────────────────────────────────
exports.getBlockList = async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user.userId;

    const user = await User.findById(requestingUserId)
      .populate('blockList', 'name avatar uid arvindId level')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const blockedUsers = (user.blockList || []).map(blocked => {
      if (!blocked || typeof blocked !== 'object') return null;
      return {
        _id: blocked._id,
        name: blocked.name || 'User',
        avatar: blocked.avatar,
        uid: blocked.uid,
        arvindId: blocked.arvindId,
        level: blocked.level || 1
      };
    }).filter(Boolean);

    res.status(200).json({
      success: true,
      data: blockedUsers,
      count: blockedUsers.length,
      blockedCount: user.blockedCount || 0
    });
  } catch (error) {
    console.error('Get Block List Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch block list' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// CHECK IF BLOCKED
// GET /api/social/check-block/:userId
// ─────────────────────────────────────────────────────────────────────────
exports.checkBlockStatus = async (req, res) => {
  try {
    const requestingUserId = req.user.id || req.user.userId;
    const { userId } = req.params;

    const currentUser = await User.findById(requestingUserId);
    const targetUser = await User.findById(userId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isBlockedByMe = currentUser.blockList.includes(userId);
    const isBlockedByThem = targetUser.blockList.includes(requestingUserId);

    res.status(200).json({
      success: true,
      isBlocked: isBlockedByMe || isBlockedByThem,
      isBlockedByMe,
      isBlockedByThem
    });
  } catch (error) {
    console.error('Check Block Status Error:', error);
    res.status(500).json({ success: false, message: 'Failed to check block status' });
  }
};