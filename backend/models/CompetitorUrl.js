const mongoose = require('mongoose');

const competitorUrlSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  isCompetitor: {
    type: Boolean,
    default: true, // Always true for this collection
    required: true,
  },
  addedOn: {
    type: Date,
    default: Date.now,
  },
});

// Mongoose will pluralize this to 'competitor_urls' collection
const CompetitorUrl = mongoose.model('CompetitorUrl', competitorUrlSchema);

module.exports = CompetitorUrl;