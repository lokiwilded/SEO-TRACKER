// backend/models/RankingData.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const rankingDataSchema = new Schema({
  keywordId: {
    type: Schema.Types.ObjectId,
    ref: 'Keyword',
    required: true,
    index: true // Index for faster lookups by keyword
  },
  url: { // The specific URL (target or competitor) found
    type: String,
    required: true,
    trim: true
  },
  position: { // The rank found
    type: Number,
    required: true
  },
  checkDate: { // When the rank was recorded
    type: Date,
    default: Date.now,
    index: true // Index for sorting/querying by date
  }
  // Optional: Add isTargetUrl flag later if needed
});

// Compound index can be useful
rankingDataSchema.index({ keywordId: 1, checkDate: -1 });

module.exports = mongoose.model('RankingData', rankingDataSchema);