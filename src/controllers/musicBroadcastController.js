const Room = require('../models/Room');
const User = require('../models/User');

// ─── PLAY TRACK ───────────────────────────────────────────────────

exports.playTrack = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId } = req.params;
    const { title, url, lyricsUrl } = req.body;

    if (!url) return res.status(400).json({ success: false, message: 'Track URL required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const isOwner = room.ownerId.toString() === userId;
    const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(userId);
    if (!isOwner && !isCoHost) {
      return res.status(403).json({ success: false, message: 'Only host/co-host can control music' });
    }

    room.currentTrack = {
      title: title || 'Untitled',
      url,
      startedAt: new Date(),
      startedBy: userId,
      isPlaying: true,
      lyricsUrl: lyricsUrl || '',
    };
    await room.save();

    return res.json({ success: true, data: room.currentTrack });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── PAUSE TRACK ──────────────────────────────────────────────────

exports.pauseTrack = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const isOwner = room.ownerId.toString() === userId;
    const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(userId);
    if (!isOwner && !isCoHost) {
      return res.status(403).json({ success: false, message: 'Only host/co-host can control music' });
    }

    room.currentTrack.isPlaying = false;
    await room.save();

    return res.json({ success: true, data: room.currentTrack });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── STOP TRACK ───────────────────────────────────────────────────

exports.stopTrack = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const isOwner = room.ownerId.toString() === userId;
    const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(userId);
    if (!isOwner && !isCoHost) {
      return res.status(403).json({ success: false, message: 'Only host/co-host can control music' });
    }

    room.currentTrack = { title: '', url: '', startedAt: null, startedBy: null, isPlaying: false, lyricsUrl: '' };
    await room.save();

    return res.json({ success: true, message: 'Track stopped', data: room.currentTrack });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ─── GET CURRENT TRACK ────────────────────────────────────────────

exports.getCurrentTrack = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId).select('currentTrack ownerId');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    return res.json({ success: true, data: room.currentTrack || null });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};
