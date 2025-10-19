const mongoose = require('mongoose');

const targetUrlSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  addedOn: {
    type: Date,
    default: Date.now,
  },

});

// Mongoose will pluralize this to 'target_urls' collection
const TargetUrl = mongoose.model('TargetUrl', targetUrlSchema); 

module.exports = TargetUrl;