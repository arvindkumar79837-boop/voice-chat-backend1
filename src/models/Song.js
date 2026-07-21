const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  artist: { type: String, default: '', index: true },
  audioUrl: { type: String, required: true },
  lyricsUrl: { type: String, default: '' },
  durationSeconds: { type: Number, default: 0 },
  coverImageUrl: { type: String, default: '' },
  genre: { type: String, default: '', index: true },
  language: { type: String, default: 'Hindi', index: true },
  isActive: { type: Boolean, default: true },
  totalPlays: { type: Number, default: 0 },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

songSchema.index({ title: 'text', artist: 'text' });

module.exports = mongoose.model('Song', songSchema);
