// backend/models/Keyword.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema; // Good practice to alias Schema

const keywordSchema = new Schema({
  keyword: {
    type: String,
    required: true,
    trim: true,
    unique: true // Ensures keywords are not duplicated
  }
}, { timestamps: true }); // Added timestamps, good for tracking

// This is the crucial line that creates and exports the model
module.exports = mongoose.model('Keyword', keywordSchema);