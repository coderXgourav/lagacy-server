const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  city: { type: String, required: true },
  state: String,
  country: { type: String, required: true },
  radius: { type: Number, default: 5000 },
  businessCategory: String,
  leadCap: { type: Number, default: 50 },
  resultsCount: { type: Number, default: 0 },
  status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
