const User = require('../models/User');

// GET /api/inventory
exports.getInventory = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const user = await User.findById(userId).select('inventory');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const items = user.inventory || [];
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/inventory/use/:itemId
exports.useItem = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { itemId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await User.findByIdAndUpdate(userId, {
      $set: { 'equipped.itemId': itemId }
    });
    res.json({ success: true, message: 'Item equipped' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/inventory/:itemId
exports.removeItem = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { itemId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await User.findByIdAndUpdate(userId, {
      $pull: { inventory: { id: itemId } }
    });
    res.json({ success: true, message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};