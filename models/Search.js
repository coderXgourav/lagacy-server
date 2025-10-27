const mongoose = require('mongoose');

const searchSchema = new mongoose.Schema({
  query: {
    type: String,
    required: true
  },
  searchType: {
    type: String,
    enum: ['domain', 'email', 'company', 'location'],
    default: 'location'
  },
  filters: {
    city: String,
    state: String,
    country: String,
    radius: Number,
    category: String,
    industry: String,
    location: String,
    companySize: String
  },
  resultsCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  apiUsed: {
    type: String,
    enum: ['whoisxml', 'hunter', 'google', 'multiple'],
    default: 'multiple'
  },
  executedAt: {
    type: Date,
    default: Date.now
  },
  errorMessage: {
    type: String,
    default: ''
  },
  downloadInfo: {
    isDownloadable: { type: Boolean, default: true },
    downloadCount: { type: Number, default: 0 },
    lastDownloadedAt: Date,
    expiresAt: Date
  }
}, {
  timestamps: true
});

// Index for efficient querying
searchSchema.index({ status: 1, executedAt: -1 });
searchSchema.index({ 'downloadInfo.isDownloadable': 1 });

module.exports = mongoose.model('Search', searchSchema);
