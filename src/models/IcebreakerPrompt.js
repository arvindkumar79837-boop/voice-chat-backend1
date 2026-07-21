const mongoose = require('mongoose');

const icebreakerPromptSchema = new mongoose.Schema({
  text: { type: String, required: true },
  category: { type: String, enum: ['FUN', 'ROMANTIC', 'DEEP', 'SILLY', 'CULTURAL'], default: 'FUN' },
  isActive: { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 },
}, { timestamps: true });

icebreakerPromptSchema.index({ isActive: 1, category: 1 });

module.exports = mongoose.model('IcebreakerPrompt', icebreakerPromptSchema);
