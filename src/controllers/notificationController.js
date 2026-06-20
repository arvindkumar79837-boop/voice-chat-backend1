// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/notificationController.js
// ARVIND PARTY - NOTIFICATIONS CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const Notification = require('../models/Notification');

// ─────────────────────────────────────────────────────────────────────────
// GET USER NOTIFICATIONS
// GET /api/notifications
// ─────────────────────────────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { userId: req.user.userId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .populate('fromUserId', 'name avatar arvindId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId: req.user.userId,
      read: false
    });

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// MARK NOTIFICATION AS READ
// PUT /api/notifications/{notificationId}/read
// ─────────────────────────────────────────────────────────────────────────
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId: req.user.userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.read = true;
    await notification.save();

    res.status(200).json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// MARK ALL NOTIFICATIONS AS READ
// PUT /api/notifications/mark-all-read
// ─────────────────────────────────────────────────────────────────────────
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { read: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// DELETE NOTIFICATION
// DELETE /api/notifications/{notificationId}
// ─────────────────────────────────────────────────────────────────────────
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: req.user.userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// CREATE NOTIFICATION (Internal helper - called by other controllers)
// POST /api/notifications (Internal)
// ─────────────────────────────────────────────────────────────────────────
exports.createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, fromUserId, data } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'userId, type, title, and message are required'
      });
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      fromUserId: fromUserId || null,
      data: data || {}
    });

    const populated = await Notification.findById(notification._id)
      .populate('fromUserId', 'name avatar arvindId');

    // Emit real-time notification via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('new_notification', populated);
    }

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Notification created successfully'
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
};