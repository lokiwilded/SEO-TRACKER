// backend/models/TargetUrl.js
const mongoose = require('mongoose');

const targetUrlSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true // Good practice
    // Consider adding unique: true if you really enforce only one document
  },
  competitorUrls: [{ // Store competitor URLs directly here
    type: String,
    trim: true
  }]
}, { timestamps: true }); // Add timestamps

// Ensure only one document can exist if strictly needed (optional, depends on API logic)
// targetUrlSchema.index({ url: 1 }, { unique: true }); // Careful with this if url can change

module.exports = mongoose.model('TargetUrl', targetUrlSchema);