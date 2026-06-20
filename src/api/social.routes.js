const express = require('express');
const router = express.Router();
const User = require('../models/User'); 
// const auth = require('../middlewares/auth'); // Uncomment and add to routes if you use auth middleware

// ==========================================
// 👥 FOLLOW & FRIENDS SYSTEM
// ==========================================

// Get Connections (Followers, Following, Friends)
router.get('/connections', async (req, res) => {
  try {
    // Replace with req.user.id if using JWT middleware
    const userId = req.user?.id || req.query.userId || req.body.userId; 
    
    const user = await User.findById(userId)
      .populate('followers', 'name avatar')
      .populate('following', 'name avatar');
      
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Friends are mutual follows (users in both followers and following arrays)
    const followingIds = user.following.map(f => f._id.toString());
    const friends = user.followers.filter(f => followingIds.includes(f._id.toString()));

    res.json({
      success: true,
      data: {
        followers: user.followers,
        following: user.following,
        friends: friends
      }
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Toggle Follow User
router.post('/follow', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { targetUserId } = req.body;

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isFollowing = user.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow Logic
      await User.findByIdAndUpdate(userId, { $pull: { following: targetUserId } });
      await User.findByIdAndUpdate(targetUserId, { $pull: { followers: userId } });
      res.json({ success: true, isFollowing: false });
    } else {
      // Follow Logic
      await User.findByIdAndUpdate(userId, { $addToSet: { following: targetUserId } });
      await User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: userId } });
      res.json({ success: true, isFollowing: true });
    }
  } catch (error) {
    console.error('Error toggling follow:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ==========================================
// 💖 COUPLE (CP) RELATIONSHIP SYSTEM
// ==========================================

// Get CP Status
router.get('/cp/status', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId || req.body.userId;
    const user = await User.findById(userId)
      .populate('cpPartner', 'name avatar')
      .populate('cpRequests', 'name avatar');

    res.json({
      success: true,
      data: {
        partner: user.cpPartner || null,
        level: user.cpLevel || 1,
        pendingRequests: user.cpRequests || []
      }
    });
  } catch (error) {
    console.error('Error fetching CP status:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Send CP Request
router.post('/cp/request', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { targetUserId } = req.body;

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, message: 'Cannot send CP request to yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    if (targetUser.cpPartner) {
      return res.status(400).json({ success: false, message: 'User already has a CP' });
    }

    await User.findByIdAndUpdate(targetUserId, { $addToSet: { cpRequests: userId } });
    res.json({ success: true, message: 'CP request sent' });
  } catch (error) {
    console.error('Error sending CP request:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Respond to CP Request
router.post('/cp/respond', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { requestId, accept } = req.body; 

    const user = await User.findById(userId);

    if (!user.cpRequests.includes(requestId)) {
      return res.status(400).json({ success: false, message: 'No such request found' });
    }

    if (accept) {
      // Check if sender got a CP in the meantime
      const sender = await User.findById(requestId);
      if (sender.cpPartner) {
        await User.findByIdAndUpdate(userId, { $pull: { cpRequests: requestId } });
        return res.status(400).json({ success: false, message: 'The sender already has a CP now.' });
      }

      // Establish CP connection and upgrade both user profiles
      await User.findByIdAndUpdate(userId, { cpPartner: requestId, cpLevel: 1, $pull: { cpRequests: requestId } });
      await User.findByIdAndUpdate(requestId, { cpPartner: userId, cpLevel: 1 });
    } else {
      // Reject CP Request
      await User.findByIdAndUpdate(userId, { $pull: { cpRequests: requestId } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error responding to CP request:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;