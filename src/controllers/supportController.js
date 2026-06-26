const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const VisitorHistory = require('../models/VisitorHistory');

// GET /api/support/faq
exports.getFAQs = async (req, res) => {
  try {
    const faqs = [
      { id: '1', question: 'How to earn coins?', answer: 'Coins can be earned by logging in daily, completing missions, and receiving gifts.' },
      { id: '2', question: 'How to withdraw money?', answer: 'Go to Wallet → Withdrawal and follow the instructions.' },
      { id: '3', question: 'How to become a creator?', answer: 'Reach level 5 and apply from the Creator Center.' },
      { id: '4', question: 'How to create a room?', answer: 'Click the + button on the home screen to create your first room.' },
    ];
    res.json({ success: true, faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/support/tickets
exports.getTickets = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    const tickets = await SupportTicket.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/support/ticket/create
exports.createTicket = async (req, res) => {
  try {
    const { subject, message, category } = req.body;
    const userId = req.user?.id || req.body.userId;
    const ticket = await SupportTicket.create({ userId, subject, message, category, status: 'open' });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/support/message
exports.sendMessage = async (req, res) => {
  try {
    const { ticketId, message } = req.body;
    await SupportTicket.findByIdAndUpdate(ticketId, {
      $push: { messages: { text: message, createdAt: new Date() } }
    });
    res.json({ success: true, message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVisitorHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.params.userId;
    const { limit = 50 } = req.query;

    const visitors = await VisitorHistory.find({ profileOwner: userId })
      .populate('visitor', 'username displayName avatar uid vipLevel role verificationType agencyId')
      .sort({ visitedAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, visitors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recordVisitor = async (req, res) => {
  try {
    const viewerId = req.user?.id;
    const { profileUserId } = req.body;

    if (!viewerId || !profileUserId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (viewerId.toString() === profileUserId.toString()) {
      return res.status(200).json({ success: true, message: 'Cannot record self-visit' });
    }

    const targetUser = await User.findById(profileUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (targetUser.blockList && targetUser.blockList.includes(viewerId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const existingVisit = await VisitorHistory.findOne({
      profileOwner: profileUserId,
      visitor: viewerId,
    }).sort({ visitedAt: -1 });

    if (existingVisit) {
      existingVisit.visitedAt = new Date();
      existingVisit.duration = 0;
      await existingVisit.save();
    } else {
      await VisitorHistory.create({
        profileOwner: profileUserId,
        visitor: viewerId,
        visitedAt: new Date(),
        duration: 0,
      });
    }

    res.json({ success: true, message: 'Visit recorded' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.togglePrivacy = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { key, value } = req.body;

    const allowedKeys = [
      'showOnlineStatus',
      'showLastSeen',
      'showGallery',
      'showFollowers',
      'showFollowing',
      'showVisitorHistory',
    ];

    if (!allowedKeys.includes(key)) {
      return res.status(400).json({ success: false, message: 'Invalid privacy key' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.privacy[key] = value;
    await user.save();

    res.json({ success: true, privacy: user.privacy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const users = await User.find(
      { $text: { $search: query }, isBanned: false },
      { score: { $meta: 'textScore' } }
    )
      .limit(parseInt(limit))
      .select('username displayName avatar uid vipLevel verificationType followersCount');

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.followUser = async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    const { targetUserId } = req.body;

    if (!currentUserId || !targetUserId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (currentUserId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (targetUser.blockList.includes(currentUserId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const isAlreadyFollowing = currentUser.following.includes(targetUserId);
    if (isAlreadyFollowing) {
      currentUser.following = currentUser.following.filter(id => id.toString() !== targetUserId.toString());
      targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUserId.toString());
      currentUser.followingCount = Math.max(0, (currentUser.followingCount || 0) - 1);
      targetUser.followersCount = Math.max(0, (targetUser.followersCount || 0) - 1);
    } else {
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);
      currentUser.followingCount = (currentUser.followingCount || 0) + 1;
      targetUser.followersCount = (targetUser.followersCount || 0) + 1;
    }

    await currentUser.save();
    await targetUser.save();

    res.json({
      success: true,
      following: !isAlreadyFollowing,
      followingCount: currentUser.followingCount,
      followersCount: targetUser.followersCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const updates = req.body;

    const allowedFields = [
      'displayName',
      'name',
      'avatar',
      'bio',
      'coverPhoto',
      'birthDate',
      'socialLinks',
      'gallery',
    ];

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        user[field] = updates[field];
      }
    });

    if (updates.name || updates.bio) {
      user.isProfileComplete = true;
    }

    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addBlockedUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { targetUserId } = req.body;

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.blockList.includes(targetUserId)) {
      user.blockList.push(targetUserId);
      user.blockedCount = (user.blockedCount || 0) + 1;

      user.followers = user.followers.filter(id => id.toString() !== targetUserId.toString());
      user.following = user.following.filter(id => id.toString() !== targetUserId.toString());
      user.followersCount = Math.max(0, (user.followersCount || 0) - 1);
      user.followingCount = Math.max(0, (user.followingCount || 0) - 1);

      await user.save();
    }

    res.json({ success: true, message: 'User blocked', blockList: user.blockList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.removeBlockedUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { targetUserId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.blockList = user.blockList.filter(id => id.toString() !== targetUserId.toString());
    user.blockedCount = Math.max(0, (user.blockedCount || 0) - 1);
    await user.save();

    res.json({ success: true, message: 'User unblocked', blockList: user.blockList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user?.id;

    const user = await User.findById(userId).populate('blockList', 'username displayName avatar uid');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, blockedUsers: user.blockList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.checkBlockStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { targetUserId } = req.query;

    if (!userId && !targetUserId) {
      return res.status(400).json({ success: false, message: 'Missing userId or targetUserId' });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isBlocked = user.blockList.includes(userId);

    res.json({ success: true, isBlocked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.replyToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, status } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (message) {
      ticket.messages.push({ text: message, createdAt: new Date() });
    }
    if (status) {
      ticket.status = status;
    }

    await ticket.save();
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    console.error('Reply To Ticket Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reply to ticket' });
  }
};