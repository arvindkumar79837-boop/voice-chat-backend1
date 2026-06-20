const SupportTicket = require('../models/SupportTicket');

// GET /api/support/faq
exports.getFAQs = async (req, res) => {
  try {
    const faqs = [
      { id: '1', question: 'How to earn coins?', answer: 'Coins can be earned by logging in daily, completing missions, and receiving gifts.' },
      { id: '2', question: 'How to withdraw money?', answer: 'Go to Wallet → Withdrawal and follow the instructions.' },
      { id: '3', question: 'How to become a creator?', answer: 'Reach level 5 and apply from the Creator Center.' },
      { id: '4', question: 'How to create a room?', answer: 'Click the + button on the home screen to create your first room.' },
    ];
    res.json({ success: true, faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/support/tickets
exports.getTickets = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    const tickets = await SupportTicket.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/support/ticket/create
exports.createTicket = async (req, res) => {
  try {
    const { subject, message, category } = req.body;
    const userId = req.user?.id || req.body.userId;
    const ticket = await SupportTicket.create({ userId, subject, message, category, status: 'open' });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/support/message
exports.sendMessage = async (req, res) => {
  try {
    const { ticketId, message } = req.body;
    await SupportTicket.findByIdAndUpdate(ticketId, {
      $push: { messages: { text: message, createdAt: new Date() } }
    });
    res.json({ success: true, message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.replyToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, status } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (message) {
      ticket.messages.push({ text: message, createdAt: new Date() });
    }
    if (status) {
      ticket.status = status;
    }

    await ticket.save();
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    console.error('Reply To Ticket Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reply to ticket' });
  }
};