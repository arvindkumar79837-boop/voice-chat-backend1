const Badge = require('../models/Badge');
const User = require('../models/User');

/**
 * Check if a user has unlocked a badge
 * @param {Object} user - User object
 * @param {Object} badge - Badge object
 * @returns {boolean} - Whether the badge is unlocked
 */
const checkBadgeUnlocked = (user, badge) => {
  const condition = badge.unlockCondition;

  switch (condition.conditionType) {
    case 'diamonds':
      return compareValues(user.diamonds, condition.value, condition.comparison);
    case 'coins':
      return compareValues(user.coins, condition.value, condition.comparison);
    case 'level':
      return compareValues(user.level, condition.value, condition.comparison);
    case 'custom':
      // For custom conditions, we'll assume they're unlocked for now
      return true;
    default:
      return false;
  }
};

/**
 * Compare two values based on comparison operator
 * @param {number} value1 - First value
 * @param {number} value2 - Second value
 * @param {string} comparison - Comparison operator
 * @returns {boolean} - Result of comparison
 */
const compareValues = (value1, value2, comparison) => {
  switch (comparison) {
    case '>=':
      return value1 >= value2;
    case '>':
      return value1 > value2;
    case '=':
      return value1 === value2;
    case '<':
      return value1 < value2;
    case '<=':
      return value1 <= value2;
    default:
      return value1 >= value2;
  }
};

/**
 * Get all badges with unlock status for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of badges with unlock status
 */
exports.getUserBadges = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return [];

    const badges = await Badge.find({ isActive: true });

    return badges.map(badge => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      iconPath: badge.iconPath,
      isUnlocked: user.badges.includes(badge.id) || checkBadgeUnlocked(user, badge)
    }));
  } catch (error) {
    console.error('Error getting user badges:', error);
    return [];
  }
};

/**
 * Check and award badges to user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of newly awarded badge IDs
 */
exports.checkAndAwardBadges = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return [];

    const badges = await Badge.find({ isActive: true });
    const newlyAwarded = [];

    for (const badge of badges) {
      if (!user.badges.includes(badge.id) && checkBadgeUnlocked(user, badge)) {
        user.badges.push(badge.id);
        newlyAwarded.push(badge.id);
      }
    }

    if (newlyAwarded.length > 0) {
      await user.save();
    }

    return newlyAwarded;
  } catch (error) {
    console.error('Error checking and awarding badges:', error);
    return [];
  }
};

/**
 * Initialize default badges
 */
// Hardcoded default badges (used when MongoDB is not available)
const FALLBACK_BADGES = [
  {
    id: 'b1',
    name: 'Top Gifter',
    description: 'Gifted over 10k diamonds',
    iconPath: '💎',
    isUnlocked: false
  },
  {
    id: 'b2',
    name: 'Coin Collector',
    description: 'Earned over 50k coins',
    iconPath: '💰',
    isUnlocked: false
  },
  {
    id: 'b3',
    name: 'Level Master',
    description: 'Reached level 10',
    iconPath: '🏆',
    isUnlocked: false
  },
  {
    id: 'b4',
    name: 'Early Bird',
    description: 'Joined Arvind Party',
    iconPath: '🐦',
    isUnlocked: true
  }
];

exports.initializeDefaultBadges = async () => {
  try {
    const existingBadges = await Badge.find();
    if (existingBadges.length > 0) return;

    const defaultBadges = [
      {
        id: 'b1',
        name: 'Top Gifter',
        description: 'Gifted over 10k diamonds',
        iconPath: '💎',
        unlockCondition: {
          conditionType: 'diamonds',
          value: 10000,
          comparison: '>='
        }
      },
      {
        id: 'b2',
        name: 'Coin Collector',
        description: 'Earned over 50k coins',
        iconPath: '💰',
        unlockCondition: {
          conditionType: 'coins',
          value: 50000,
          comparison: '>='
        }
      },
      {
        id: 'b3',
        name: 'Level Master',
        description: 'Reached level 10',
        iconPath: '🏆',
        unlockCondition: {
          conditionType: 'level',
          value: 10,
          comparison: '>='
        }
      },
      {
        id: 'b4',
        name: 'Early Bird',
        description: 'Joined Arvind Party',
        iconPath: '🐦',
        unlockCondition: {
          conditionType: 'custom',
          value: 0,
          comparison: '='
        }
      }
    ];

    await Badge.insertMany(defaultBadges);
    console.log('✅ Default badges initialized');
  } catch (error) {
    console.error('Error initializing default badges:', error);
  }
};
