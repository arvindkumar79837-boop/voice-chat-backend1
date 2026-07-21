const Room = require('../models/Room');
const Song = require('../models/Song');
const User = require('../models/User');

exports.searchSongs = async (req, res) => {
  try {
    const { search, genre, language, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };
    if (search) filter.$text = { $search: search };
    if (genre) filter.genre = genre;
    if (language) filter.language = language;
    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [songs, total] = await Promise.all([
      Song.find(filter).sort({ totalPlays: -1 }).skip(skip).limit(parseInt(limit)),
      Song.countDocuments(filter)
    ]);
    return res.json({ success: true, data: { songs, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.addSong = async (req, res) => {
  try {
    const { title, artist, audioUrl, lyricsUrl, durationSeconds, coverImageUrl, genre, language } = req.body;
    if (!title || !audioUrl) return res.status(400).json({ success: false, message: 'title and audioUrl required' });
    const song = await Song.create({ title, artist, audioUrl, lyricsUrl, durationSeconds, coverImageUrl, genre, language, addedBy: req.user?.id || req.user?.userId });
    return res.json({ success: true, data: song });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.updateSong = async (req, res) => {
  try {
    const song = await Song.findByIdAndUpdate(req.params.songId, req.body, { new: true });
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    return res.json({ success: true, data: song });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteSong = async (req, res) => {
  try {
    await Song.findByIdAndDelete(req.params.songId);
    return res.json({ success: true, message: 'Song deleted' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.joinQueue = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId, songId } = req.body;
    if (!roomId || !songId) return res.status(400).json({ success: false, message: 'roomId and songId required' });
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.roomType !== 'SINGING') return res.status(400).json({ success: false, message: 'Not a singing room' });
    if (room.micQueue.includes(userId)) return res.status(400).json({ success: false, message: 'Already in queue' });
    room.micQueue.push(userId);
    room.micQueueSongs.push(songId);
    await room.save();
    return res.json({ success: true, data: { position: room.micQueue.indexOf(userId) + 1, queueLength: room.micQueue.length } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.leaveQueue = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const idx = room.micQueue.findIndex(id => id.toString() === userId);
    if (idx === -1) return res.status(400).json({ success: false, message: 'Not in queue' });
    room.micQueue.splice(idx, 1);
    room.micQueueSongs.splice(idx, 1);
    await room.save();
    return res.json({ success: true, message: 'Removed from queue' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.startPerformance = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const isOwner = room.ownerId.toString() === userId;
    const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(userId);
    if (!isOwner && !isCoHost) return res.status(403).json({ success: false, message: 'Only host/co-host can start performances' });
    if (room.micQueue.length === 0) return res.status(400).json({ success: false, message: 'Queue is empty' });
    const performerId = room.micQueue.shift();
    const songId = room.micQueueSongs.shift();
    room.currentPerformerId = performerId;
    room.currentSongId = songId;
    room.performanceStartedAt = new Date();
    room.singingLikeCount = 0;
    await room.save();
    const song = await Song.findById(songId).select('title artist audioUrl lyricsUrl durationSeconds coverImageUrl');
    await Song.findByIdAndUpdate(songId, { $inc: { totalPlays: 1 } });
    return res.json({ success: true, data: { performerId, song, startedAt: room.performanceStartedAt, queueLength: room.micQueue.length } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.endPerformance = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const isOwner = room.ownerId.toString() === userId;
    const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(userId);
    const isPerformer = room.currentPerformerId?.toString() === userId;
    if (!isOwner && !isCoHost && !isPerformer) return res.status(403).json({ success: false, message: 'Not authorized' });
    const endedPerformerId = room.currentPerformerId;
    const totalLikes = room.singingLikeCount;
    room.currentPerformerId = null;
    room.currentSongId = null;
    room.performanceStartedAt = null;
    room.singingLikeCount = 0;
    await room.save();
    return res.json({ success: true, data: { endedPerformerId, totalLikes, queueLength: room.micQueue.length } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.removeUserFromQueue = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId, targetUserId } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const isOwner = room.ownerId.toString() === userId;
    const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(userId);
    if (!isOwner && !isCoHost) return res.status(403).json({ success: false, message: 'Only host/co-host can manage queue' });
    const idx = room.micQueue.findIndex(id => id.toString() === targetUserId);
    if (idx === -1) return res.status(400).json({ success: false, message: 'User not in queue' });
    room.micQueue.splice(idx, 1);
    room.micQueueSongs.splice(idx, 1);
    await room.save();
    return res.json({ success: true, message: 'User removed from queue' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.addLike = async (roomId) => {
  const room = await Room.findByIdAndUpdate(roomId, { $inc: { singingLikeCount: 1 } }, { new: true }).select('singingLikeCount');
  return room?.singingLikeCount || 0;
};

exports.getQueue = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId).populate('micQueue', 'name avatar').populate('micQueueSongs', 'title artist coverImageUrl durationSeconds');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const queue = room.micQueue.map((user, i) => ({ user, song: room.micQueueSongs[i] || null }));
    return res.json({ success: true, data: { queue, currentPerformerId: room.currentPerformerId, currentSongId: room.currentSongId } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.forceMutePerformer = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { roomId } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const isOwner = room.ownerId.toString() === userId;
    const isCoHost = (room.coHosts || []).map(id => id.toString()).includes(userId);
    if (!isOwner && !isCoHost) return res.status(403).json({ success: false, message: 'Only host/co-host can mute performers' });
    return res.json({ success: true, message: 'Mute signal sent', performerId: room.currentPerformerId });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};
