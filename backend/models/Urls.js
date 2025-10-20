// backend/models/Urls.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const urlsSchema = new Schema({
  url: {
    type: String,
    required: true,
    trim: true
  },
  competitorUrls: [{
    type: String,
    trim: true
  }]
}, { timestamps: true });

// Ensure this file also exports the model
module.exports = mongoose.model('Urls', urlsSchema); // Use 'Urls' here to match your server.js