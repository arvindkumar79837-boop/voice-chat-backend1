const Family = require('../models/Family');
const User = require('../models/User');

// Get user's family
exports.getMyFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).populate('family');

    if (!user || !user.family) {
      return res.status(404).json({ success: false, message: 'No family found' });
    }

    res.status(200).json({ success: true, family: user.family });
  } catch (error) {
    console.error('Get Family Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get family' });
  }
};

// Create a new Family
exports.createFamily = async (req, res) => {
  try {
    const { userId, name, avatar } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    
    // 1. Check if user is already in a family
    if (user.familyId) {
      return res.status(400).json({ success: false, message: 'You are already in a family.' });
    }

    // 2. Generate unique Family ID
    const familyId = `FAM${Math.floor(10000 + Math.random() * 90000)}`;

    const newFamily = new Family({
      familyId,
      name,
      avatar,
      patriarchId: user._id,
      memberCount: 1
    });

    await newFamily.save();

    // 3. Update user record with Patriarch status
    user.familyId = familyId;
    user.familyRole = 'Patriarch'; 
    await user.save();

    res.status(201).json({ success: true, message: 'Family created successfully!', data: newFamily });

  } catch (error) {
    console.error('Error creating family:', error);
    res.status(500).json({ success: false, message: 'Server error while creating family' });
  }
};

// Join a Family
exports.joinFamily = async (req, res) => {
  try {
    const { userId, familyId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.familyId) {
      return res.status(400).json({ success: false, message: 'You are already in a family.' });
    }

    const family = await Family.findOne({ familyId: familyId, isActive: true });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found or inactive.' });
    }

    user.familyId = family.familyId;
    user.familyRole = 'Member';
    await user.save();

    family.memberCount += 1;
    await family.save();

    res.status(200).json({ success: true, message: 'Joined family successfully!', data: family });
  } catch (error) {
    console.error('Error joining family:', error);
    res.status(500).json({ success: false, message: 'Server error while joining family' });
  }
};

// Leave a Family
exports.leaveFamily = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(400).json({ success: false, message: 'You are not in any family.' });
    }

    if (user.familyRole === 'Patriarch') {
      return res.status(400).json({ success: false, message: 'The Patriarch cannot leave. You must disband the family or transfer ownership.' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    
    user.familyId = null;
    user.familyRole = null;
    await user.save();

    if (family) {
      family.memberCount = Math.max(0, family.memberCount - 1);
      await family.save();
    }

    res.status(200).json({ success: true, message: 'Left family successfully.' });
  } catch (error) {
    console.error('Error leaving family:', error);
    res.status(500).json({ success: false, message: 'Server error while leaving family' });
  }
};