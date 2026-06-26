const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const FamilyChat = require('../models/FamilyChat');
const Family = require('../models/Family');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

// Get family chat messages
router.get('/:familyId/messages', auth, async (req, res) => {
  try {
    const { familyId } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || user.familyId !== familyId) {
      return errorResponse(res, 'Access denied', 403);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = { familyId, isDeleted: false };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await FamilyChat.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return successResponse(res, 'Messages fetched', messages.reverse());
  } catch (error) {
    console.error('Get Messages Error:', error);
    return errorResponse(res, 'Failed to get messages');
  }
});

// Send family message
router.post('/:familyId/messages', auth, async (req, res) => {
  try {
    const { familyId } = req.params;
    const { content, messageType = 'text', replyTo, mentions, attachments } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || user.familyId !== familyId) {
      return errorResponse(res, 'Access denied', 403);
    }

    if (!content || content.trim().length === 0) {
      return errorResponse(res, 'Message cannot be empty', 400);
    }

    const message = new FamilyChat({
      familyId,
      senderUid: user.uid,
      senderName: user.username,
      senderAvatar: user.avatar || '',
      content: content.trim(),
      messageType,
      replyTo: replyTo || null,
      mentions: mentions || [],
      attachments: attachments || []
    });

    await message.save();

    // Emit via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('family_message', message.toObject());
    }

    return successResponse(res, 'Message sent', message);
  } catch (error) {
    console.error('Send Message Error:', error);
    return errorResponse(res, 'Failed to send message');
  }
});

// Delete family message
router.delete('/:familyId/messages/:messageId', auth, async (req, res) => {
  try {
    const { familyId, messageId } = req.params;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || user.familyId !== familyId) {
      return errorResponse(res, 'Access denied', 403);
    }

    const message = await FamilyChat.findById(messageId);
    if (!message) {
      return errorResponse(res, 'Message not found', 404);
    }

    // Only sender or patriarch can delete
    if (message.senderUid !== user.uid && user.familyRole !== 'Patriarch') {
      return errorResponse(res, 'Permission denied', 403);
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    // Emit deletion via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('message_deleted', { messageId });
    }

    return successResponse(res, 'Message deleted');
  } catch (error) {
    console.error('Delete Message Error:', error);
    return errorResponse(res, 'Failed to delete message');
  }
});

// Pin family message
router.post('/:familyId/messages/:messageId/pin', auth, async (req, res) => {
  try {
    const { familyId, messageId } = req.params;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || user.familyId !== familyId) {
      return errorResponse(res, 'Access denied', 403);
    }

    const message = await FamilyChat.findById(messageId);
    if (!message) {
      return errorResponse(res, 'Message not found', 404);
    }

    message.isPinned = !message.isPinned;
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('message_pinned', { messageId, isPinned: message.isPinned });
    }

    return successResponse(res, message.isPinned ? 'Message pinned' : 'Message unpinned');
  } catch (error) {
    console.error('Pin Message Error:', error);
    return errorResponse(res, 'Failed to update pin status');
  }
});

// Add reaction to message
router.post('/:familyId/messages/:messageId/react', auth, async (req, res) => {
  try {
    const { familyId, messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || user.familyId !== familyId) {
      return errorResponse(res, 'Access denied', 403);
    }

    const message = await FamilyChat.findById(messageId);
    if (!message) {
      return errorResponse(res, 'Message not found', 404);
    }

    const existingReaction = message.reactions.find(r => r.uid === user.uid);
    if (existingReaction) {
      existingReaction.emoji = emoji;
      existingReaction.reactedAt = new Date();
    } else {
      message.reactions.push({
        uid: user.uid,
        emoji,
        reactedAt: new Date()
      });
    }

    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('reaction_added', {
        messageId,
        reactions: message.reactions
      });
    }

    return successResponse(res, 'Reaction added');
  } catch (error) {
    console.error('Add Reaction Error:', error);
    return errorResponse(res, 'Failed to add reaction');
  }
});

// Get pinned messages
router.get('/:familyId/pinned', auth, async (req, res) => {
  try {
    const { familyId } = req.params;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || user.familyId !== familyId) {
      return errorResponse(res, 'Access denied', 403);
    }

    const pinnedMessages = await FamilyChat.find({
      familyId,
      isPinned: true,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return successResponse(res, 'Pinned messages fetched', pinnedMessages);
  } catch (error) {
    console.error('Get Pinned Messages Error:', error);
    return errorResponse(res, 'Failed to get pinned messages');
  }
});

module.exports = router;