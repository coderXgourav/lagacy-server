const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  batchId: {
    type: String,
    unique: true
  },
  skills: [{
    type: String
  }],
  location: {
    type: String,
    required: true
  },
  calendarUrl: {
    type: String
  },
  urgency: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED', 'PAUSED'],
    default: 'OPEN'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Job', jobSchema);
