// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/controllers/eventController.js
// ARVIND PARTY - EVENTS CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const Event = require('../models/Event');

// ─────────────────────────────────────────────────────────────────────────
// GET EVENTS LIST
// GET /api/events/list
// ─────────────────────────────────────────────────────────────────────────
exports.getEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;

    const events = await Event.find(query)
      .populate('createdBy', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET SINGLE EVENT
// GET /api/events/{eventId}
// ─────────────────────────────────────────────────────────────────────────
exports.getEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).populate('createdBy', 'name avatar');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// JOIN EVENT
// POST /api/events/{eventId}/join
// ─────────────────────────────────────────────────────────────────────────
exports.joinEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Event is not active'
      });
    }

    if (event.maxParticipants > 0 && event.participantsCount >= event.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Event is full'
      });
    }

    if (event.participants.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Already joined this event'
      });
    }

    event.participants.push(userId);
    event.participantsCount = event.participants.length;
    await event.save();

    res.status(200).json({
      success: true,
      data: {
        participantsCount: event.participantsCount,
        message: 'Joined event successfully'
      }
    });
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join event'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// LEAVE EVENT
// POST /api/events/{eventId}/leave
// ─────────────────────────────────────────────────────────────────────────
exports.leaveEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!event.participants.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Not joined this event'
      });
    }

    event.participants = event.participants.filter(id => id.toString() !== userId.toString());
    event.participantsCount = event.participants.length;
    await event.save();

    res.status(200).json({
      success: true,
      data: {
        participantsCount: event.participantsCount,
        message: 'Left event successfully'
      }
    });
  } catch (error) {
    console.error('Error leaving event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave event'
    });
  }
};