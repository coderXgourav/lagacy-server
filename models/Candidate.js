const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  linkedinUrl: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String
  },
  phone: {
    type: String
  },
  companyData: {
    type: Object // Flexible structure for whatever company info is fetched
  },
  confidenceScore: {
    type: Number,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['NEW', 'ENRICHING', 'READY', 'NEEDS_REVIEW', 'LINKEDIN_SENT', 'REJECTED'],
    default: 'NEW'
  },
  agentNotes: {
    type: String
  },
  rejectionReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Candidate', candidateSchema);
