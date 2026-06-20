const Message = require('../models/RoomMessage');

exports.getChatHistory = async (req, res) => {
  try {
    const { userId, targetId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Find messages where the two users are either the sender or receiver
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: targetId },
        { senderId: targetId, receiverId: userId }
      ]
    })
    .sort({ createdAt: -1 }) // Sort descending so newest is first (for reversed ListView)
    .limit(limit);

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ success: false, message: 'Server error fetching messages.' });
  }
};