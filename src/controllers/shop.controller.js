const Logger = require('../utils/logger');
const User = require('../models/User');
const ShopItem = require('../models/ShopItem');

exports.getItems = async (req, res) => {
  try {
    const items = await ShopItem.find({ isActive: true }).sort({ displayOrder: 1 });
    res.status(200).json({ items });
  } catch (error) {
    Logger.error('Get Shop Items Error:', error);
    res.status(500).json({ message: 'Failed to fetch items' });
  }
};

exports.purchaseItem = async (req, res) => {
  try {
    const { itemId } = req.body;
    const userId = req.user.userId;

    const item = await ShopItem.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + item.durationDays);

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, diamonds: { $gte: item.priceDiamonds } },
      {
        $inc: { diamonds: -item.priceDiamonds },
        $push: { inventory: { itemId: item._id, purchasedAt: new Date(), expiresAt } }
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({ message: 'Insufficient diamonds' });
    }

    res.status(200).json({ message: 'Item purchased successfully', expiresAt });
  } catch (error) {
    Logger.error('Purchase Error:', error);
    res.status(500).json({ message: 'Failed to process purchase transaction' });
  }
};