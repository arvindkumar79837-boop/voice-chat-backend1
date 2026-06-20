const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  category: { type: String, default: 'general' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  messages: [{
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);