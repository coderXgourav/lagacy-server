const mongoose = require('mongoose');

const newDomainSearchSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  keywords: { type: String, required: true },
  tlds: [{ type: String, required: true }],
  daysBack: { type: Number, default: 7 },
  leads: { type: Number, default: 100 },
  resultsCount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NewDomainSearch', newDomainSearchSchema);
