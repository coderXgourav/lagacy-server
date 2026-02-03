const mongoose = require('mongoose');

const newBusinessSearchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  city: { type: String, required: true },
  state: String,
  country: { type: String, required: true },
  radius: { type: Number, default: 5000 },
  niche: String,
  daysBack: { type: Number, default: 30 },
  leads: { type: Number, default: 100 },
  resultsCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  cancelRequested: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

module.exports = mongoose.model('NewBusinessSearch', newBusinessSearchSchema);
