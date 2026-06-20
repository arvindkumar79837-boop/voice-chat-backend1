const User = require('../models/User');

// In-memory matchmaking queue (Use Redis in production for horizontal scaling)
let matchmakingQueue = [];

exports.searchMatch = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Add user to queue if not already in it
    if (!matchmakingQueue.includes(userId)) {
      matchmakingQueue.push(userId);
    }

    // Simulate waiting for a match (In production, a CRON job or background worker handles this)
    setTimeout(async () => {
      // For demo purposes, we will resolve the match with a placeholder response.
      // Later, we query MongoDB for an actual queued user.
      const match = {
        userId: 'user_99',
        name: 'Priya',
        avatar: 'https://picsum.photos/seed/priya/200',
        age: 22,
        gender: 'Female',
      };
      
      res.status(200).json({ match });
    }, 3000); // 3 seconds search delay
  } catch (error) {
    console.error('Matchmaking Search Error:', error);
    res.status(500).json({ message: 'Failed to search for match' });
  }
};

exports.stopSearch = async (req, res) => {
  try {
    const userId = req.user.userId;
    matchmakingQueue = matchmakingQueue.filter(id => id !== userId);
    res.status(200).json({ message: 'Removed from matchmaking queue' });
  } catch (error) {
    res.status(500).json({ message: 'Error stopping search' });
  }
};