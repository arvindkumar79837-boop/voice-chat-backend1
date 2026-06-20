// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/momentController.js
// ARVIND PARTY - MOMENTS / POSTS CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const Moment = require('../models/Moment');
const { validationResult } = require('express-validator');

// ─────────────────────────────────────────────────────────────────────────
// GET MOMENTS FEED
// GET /api/moments
// ─────────────────────────────────────────────────────────────────────────
exports.getMomentsFeed = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const moments = await Moment.find()
      .populate('userId', 'name avatar arvindId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Moment.countDocuments();

    res.status(200).json({
      success: true,
      data: moments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching moments feed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch moments feed'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// CREATE MOMENT
// POST /api/moments/create
// ─────────────────────────────────────────────────────────────────────────
exports.createMoment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { content, mediaUrls, mediaType } = req.body;

    const moment = await Moment.create({
      userId: req.user.userId,
      content,
      mediaUrls: mediaUrls || [],
      mediaType: mediaType || 'image'
    });

    const populated = await Moment.findById(moment._id).populate('userId', 'name avatar arvindId');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Moment created successfully'
    });
  } catch (error) {
    console.error('Error creating moment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create moment'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET SINGLE MOMENT
// GET /api/moments/{momentId}
// ─────────────────────────────────────────────────────────────────────────
exports.getMoment = async (req, res) => {
  try {
    const { momentId } = req.params;

    const moment = await Moment.findById(momentId).populate('userId', 'name avatar arvindId');

    if (!moment) {
      return res.status(404).json({
        success: false,
        message: 'Moment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: moment
    });
  } catch (error) {
    console.error('Error fetching moment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch moment'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// LIKE MOMENT
// POST /api/moments/{momentId}/like
// ─────────────────────────────────────────────────────────────────────────
exports.likeMoment = async (req, res) => {
  try {
    const { momentId } = req.params;

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({
        success: false,
        message: 'Moment not found'
      });
    }

    const userId = req.user.userId;

    if (moment.likes.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Already liked'
      });
    }

    moment.likes.push(userId);
    moment.likesCount = moment.likes.length;
    await moment.save();

    res.status(200).json({
      success: true,
      data: {
        likesCount: moment.likesCount,
        isLiked: true
      }
    });
  } catch (error) {
    console.error('Error liking moment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like moment'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// UNLIKE MOMENT
// POST /api/moments/{momentId}/unlike
// ─────────────────────────────────────────────────────────────────────────
exports.unlikeMoment = async (req, res) => {
  try {
    const { momentId } = req.params;

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({
        success: false,
        message: 'Moment not found'
      });
    }

    const userId = req.user.userId;

    moment.likes = moment.likes.filter(id => id.toString() !== userId.toString());
    moment.likesCount = moment.likes.length;
    await moment.save();

    res.status(200).json({
      success: true,
      data: {
        likesCount: moment.likesCount,
        isLiked: false
      }
    });
  } catch (error) {
    console.error('Error unliking moment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlike moment'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ADD COMMENT TO MOMENT
// POST /api/moments/{momentId}/comment
// ─────────────────────────────────────────────────────────────────────────
exports.addComment = async (req, res) => {
  try {
    const { momentId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({
        success: false,
        message: 'Moment not found'
      });
    }

    moment.comments.push({
      userId: req.user.userId,
      text: text.trim()
    });

    moment.commentsCount = moment.comments.length;
    await moment.save();

    const comment = moment.comments[moment.comments.length - 1];
    const populated = await Moment.findById(momentId).populate('comments.userId', 'name avatar');

    res.status(201).json({
      success: true,
      data: populated.comments[moment.comments.length - 1]
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// DELETE COMMENT FROM MOMENT
// DELETE /api/moments/{momentId}/comment/{commentId}
// ─────────────────────────────────────────────────────────────────────────
exports.deleteComment = async (req, res) => {
  try {
    const { momentId, commentId } = req.params;

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({
        success: false,
        message: 'Moment not found'
      });
    }

    moment.comments = moment.comments.filter(c => c._id.toString() !== commentId);
    moment.commentsCount = moment.comments.length;
    await moment.save();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// DELETE MOMENT
// DELETE /api/moments/{momentId}
// ─────────────────────────────────────────────────────────────────────────
exports.deleteMoment = async (req, res) => {
  try {
    const { momentId } = req.params;

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({
        success: false,
        message: 'Moment not found'
      });
    }

    if (moment.userId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this moment'
      });
    }

    await Moment.findByIdAndDelete(momentId);

    res.status(200).json({
      success: true,
      message: 'Moment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting moment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete moment'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// SEARCH MOMENTS
// GET /api/moments/search
// ─────────────────────────────────────────────────────────────────────────
exports.searchMoments = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const query = {
      $text: { $search: q.trim() }
    };

    const moments = await Moment.find(query)
      .populate('userId', 'name avatar arvindId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Moment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: moments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error searching moments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search moments'
    });
  }
};