const mongoose = require('mongoose');

const appLocalizationStringSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  translations: {
    type: Map,
    of: {
      text: {
        type: String,
        required: true
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    required: true
  },
  category: {
    type: String,
    enum: ['common', 'auth', 'home', 'room', 'chat', 'gift', 'wallet', 'profile', 'family', 'shop', 'game', 'event', 'notification', 'settings', 'error', 'success', 'vip', 'agency', 'dealer'],
    default: 'common'
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

appLocalizationStringSchema.index({ key: 1, 'translations.en.text': 1 });

module.exports = mongoose.model('AppLocalizationString', appLocalizationStringSchema);