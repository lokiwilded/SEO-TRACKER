const mongoose = require('mongoose');

// Sub-schema for a single historical ranking entry
const rankingSchema = new mongoose.Schema({
  // We will link this to the correct URL document (TargetUrl or CompetitorUrl)
  urlId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  rank: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const keywordSchema = new mongoose.Schema({
  term: {
    type: String,
    required: true,
    unique: true, // Ensures no duplicate keywords
    trim: true,
    index: true,
  },
  // Array to store historical rankings across all tracked URLs
  historicalRankings: [rankingSchema],
  addedOn: {
    type: Date,
    default: Date.now,
  },
});

// Mongoose will pluralize this to the 'keywords' collection
const Keyword = mongoose.model('Keyword', keywordSchema);

module.exports = Keyword;