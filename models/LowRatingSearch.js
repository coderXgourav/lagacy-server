const mongoose = require('mongoose');

const lowRatingSearchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  city: { type: String, required: true },
  state: String,
  country: { type: String, required: true },
  radius: { type: Number, required: true },
  niche: String,
  maxRating: { type: Number, default: 3.0 },
  leads: { type: Number, default: 200 },
  resultsCount: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now },
  executedAt: Date
});

module.exports = mongoose.model('LowRatingSearch', lowRatingSearchSchema);
