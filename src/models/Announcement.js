const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, default: 'System Notice' },
  message: { type: String, required: true },
  link: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Announcement', announcementSchema);