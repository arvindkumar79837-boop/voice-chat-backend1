const Frame = require('./frame.model');
const User = require('../../models/User'); // Assuming User model path

// Fetch all available frames in the store
exports.getAllFrames = async (req, res) => {
  try {
    const frames = await Frame.find({ isActive: true }).sort({ priceCoins: 1 });
    res.status(200).json({ success: true, frames });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching frames' });
  }
};

// Buy a frame
exports.buyFrame = async (req, res) => {
  try {
    const { frameId } = req.body;
    const userId = req.user.userId || req.user.id; // From Auth Middleware

    const frame = await Frame.findById(frameId);
    if (!frame) return res.status(404).json({ success: false, message: 'Frame not found' });

    const user = await User.findById(userId);
    if (user.coins < frame.priceCoins) {
      return res.status(400).json({ success: false, message: 'Insufficient coins to buy this frame' });
    }

    // Deduct coins
    user.coins -= frame.priceCoins;
    
    // Initialize arrays if they don't exist
    if (!user.ownedFrames) user.ownedFrames = [];
    
    // Check if already owns the frame
    const alreadyOwned = user.ownedFrames.find(f => f.frameId.toString() === frameId);
    if (!alreadyOwned) {
      user.ownedFrames.push({ frameId: frame._id, expiresAt: new Date(Date.now() + frame.validityDays * 24 * 60 * 60 * 1000) });
    }

    // Auto-equip the newly bought frame
    user.equippedFrame = frame.imageUrl;
    await user.save();

    res.status(200).json({ success: true, message: 'Frame purchased successfully!', remainingCoins: user.coins, equippedFrame: user.equippedFrame });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during purchase' });
  }
};