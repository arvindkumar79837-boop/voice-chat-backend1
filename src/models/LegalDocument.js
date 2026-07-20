const mongoose = require('mongoose');

const legalDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'COMMUNITY_GUIDELINES'],
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: 'en',
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('LegalDocument', legalDocumentSchema);
