const AgencyInvitation = require('../models/AgencyInvitation');
const Agency = require('../models/Agency');
const User = require('../models/User');
const Notification = require('../models/Notification');

// ─────────────────────────────────────────────────────────────────────────
// AGENCY OWNER: SEND INVITATION TO USER BY UID
// POST /api/agency/invitations/send
// ─────────────────────────────────────────────────────────────────────────
exports.sendInvitation = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { targetUid, message, specialRoles } = req.body;

    if (!targetUid) {
      return res.status(400).json({ success: false, message: 'Target UID is required' });
    }

    const agency = await Agency.findOne({ owner: userId });
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found. Create an agency first.' });
    }

    const targetUser = await User.findOne({ uid: targetUid });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found with this UID' });
    }

    if (targetUser._id.toString() === userId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot invite yourself' });
    }

    if (agency.hosts.some(h => h.toString() === targetUser._id.toString())) {
      return res.status(400).json({ success: false, message: 'User is already a member of your agency' });
    }

    const existing = await AgencyInvitation.findOne({
      agencyId: agency._id,
      targetUserId: targetUser._id,
      status: 'pending'
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Invitation already pending for this user' });
    }

    const invitation = await AgencyInvitation.create({
      agencyId: agency._id,
      agencyName: agency.name,
      invitedBy: userId,
      invitedByUid: req.user.uid || userId.toString(),
      targetUserId: targetUser._id,
      targetUid: targetUser.uid,
      message: message || '',
      specialRoles: specialRoles || {}
    });

    await Notification.create({
      userId: targetUser._id,
      type: 'agency_invite',
      title: 'Agency Invitation',
      body: `${agency.name} has invited you to join their agency.`,
      data: {
        invitationId: invitation._id,
        agencyId: agency._id,
        agencyName: agency.name,
        invitedBy: userId.toString()
      }
    });

    res.status(201).json({
      success: true,
      invitation,
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Send Invitation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send invitation' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// USER: GET MY INBOX (PENDING INVITATIONS)
// GET /api/agency/invitations/inbox
// ─────────────────────────────────────────────────────────────────────────
exports.getInbox = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const invitations = await AgencyInvitation.find({
      targetUserId: userId,
      status: 'pending'
    })
      .populate('agencyId', 'name logo description')
      .populate('invitedBy', 'name avatar uid')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: invitations,
      count: invitations.length
    });
  } catch (error) {
    console.error('Get Inbox Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inbox' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// USER: ACCEPT INVITATION
// POST /api/agency/invitations/accept/:invitationId
// ─────────────────────────────────────────────────────────────────────────
exports.acceptInvitation = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { invitationId } = req.params;

    const invitation = await AgencyInvitation.findOne({
      _id: invitationId,
      targetUserId: userId,
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found or already processed' });
    }

    invitation.status = 'accepted';
    invitation.respondedAt = new Date();
    await invitation.save();

    const agency = await Agency.findById(invitation.agencyId);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    if (!agency.hosts.includes(userId)) {
      agency.hosts.push(userId);
      agency.totalHosts = agency.hosts.length;
      await agency.save();
    }

    const specialRoles = invitation.specialRoles || {};
    const updatePayload = {
      agencyId: agency._id,
      role: 'host',
      specialRoles: specialRoles
    };

    if (specialRoles.vipFrame) {
      updatePayload.equippedFrame = 'vip_agency_frame';
      updatePayload.unlockedFrames = ['vip_agency_frame'];
    }

    await User.findByIdAndUpdate(userId, updatePayload);

    res.status(200).json({
      success: true,
      agency,
      specialRoles,
      message: 'Invitation accepted. Welcome to the agency!'
    });
  } catch (error) {
    console.error('Accept Invitation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept invitation' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// USER: REJECT INVITATION
// POST /api/agency/invitations/reject/:invitationId
// ─────────────────────────────────────────────────────────────────────────
exports.rejectInvitation = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { invitationId } = req.params;

    const invitation = await AgencyInvitation.findOne({
      _id: invitationId,
      targetUserId: userId,
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found or already processed' });
    }

    invitation.status = 'rejected';
    invitation.respondedAt = new Date();
    await invitation.save();

    res.status(200).json({
      success: true,
      message: 'Invitation rejected'
    });
  } catch (error) {
    console.error('Reject Invitation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject invitation' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// USER: SEARCH USER BY UID
// GET /api/users/search?uid=XXX
// ─────────────────────────────────────────────────────────────────────────
exports.searchUserByUid = async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ success: false, message: 'UID is required' });
    }

    const user = await User.findOne({ uid })
      .select('name avatar uid arvindId level isVip vipLevel agencyId role')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const populated = await User.findById(user._id)
      .populate('agencyId', 'name logo')
      .lean();

    res.status(200).json({
      success: true,
      data: populated
    });
  } catch (error) {
    console.error('Search User Error:', error);
    res.status(500).json({ success: false, message: 'Failed to search user' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET ALL NOTIFICATIONS / INBOX ITEMS
// GET /api/notifications/inbox
// ─────────────────────────────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ userId, read: false });

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// MARK NOTIFICATION AS READ
// POST /api/notifications/read/:notificationId
// ─────────────────────────────────────────────────────────────────────────
exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error('Mark Read Error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// MARK ALL NOTIFICATIONS AS READ
// POST /api/notifications/read-all
// ─────────────────────────────────────────────────────────────────────────
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    await Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark All Read Error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
  }
};