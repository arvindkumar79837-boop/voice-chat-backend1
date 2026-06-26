const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  cuisineType: {
    type: [String],
    required: true,
    enum: ['indian', 'chinese', 'italian', 'mexican', 'thai', 'japanese', 'korean', 'american', 'mediterranean', 'vegetarian', 'fast_food', 'desserts', 'beverages']
  },
  location: {
    area: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true,
      default: 'Mumbai'
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    address: String
  },
  pricing: {
    budgetPerPerson: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  rating: {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    totalReviews: {
      type: Number,
      default: 0
    }
  },
  features: {
    vegetarianFriendly: {
      type: Boolean,
      default: false
    },
    outdoorSeating: {
      type: Boolean,
      default: false
    },
    deliveryAvailable: {
      type: Boolean,
      default: false
    },
    parkingAvailable: {
      type: Boolean,
      default: false
    },
    acceptsCards: {
      type: Boolean,
      default: true
    },
    liveMusic: {
      type: Boolean,
      default: false
    }
  },
  operatingHours: {
    open: String,
    close: String,
    days: [String]
  },
  contact: {
    phone: String,
    email: String,
    website: String
  },
  images: [String],
  description: String,
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  recommendationScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for fast queries
restaurantSchema.index({ location: 1, 'pricing.budgetPerPerson': 1 });
restaurantSchema.index({ cuisineType: 1 });
restaurantSchema.index({ 'rating.average': -1 });
restaurantSchema.index({ recommendationScore: -1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);