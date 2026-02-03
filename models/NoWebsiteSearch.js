const mongoose = require('mongoose');

const noWebsiteSearchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  city: { type: String, required: true },
  state: String,
  country: { type: String, required: true },
  coordinates: {
    lat: Number,
    lng: Number
  },
  radius: { type: Number, required: true },
  niche: String,
  useHunter: { type: Boolean, default: true },
  resultsCount: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  cancelRequested: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  executedAt: Date,
  completedAt: Date
});

module.exports = mongoose.model('NoWebsiteSearch', noWebsiteSearchSchema);
