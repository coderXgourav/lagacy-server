const mongoose = require('mongoose');

const searchResultSchema = new mongoose.Schema({
  searchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Search',
    required: true,
    index: true
  },
  businessData: {
    name: { type: String, required: true },
    website: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    country: String,
    category: String,
    industry: String,
    domainAge: Number,
    registrar: String,
    ownerName: String,
    isLegacy: { type: Boolean, default: false }
  },
  metadata: {
    source: { type: String, enum: ['whoisxml', 'hunter', 'google', 'manual'], required: true },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
    verificationStatus: { type: String, enum: ['verified', 'unverified', 'invalid'], default: 'unverified' }
  },
  downloadStatus: {
    isIncludedInDownload: { type: Boolean, default: true },
    downloadedCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
searchResultSchema.index({ searchId: 1, 'downloadStatus.isIncludedInDownload': 1 });
searchResultSchema.index({ 'businessData.isLegacy': 1, searchId: 1 });

module.exports = mongoose.model('SearchResult', searchResultSchema);