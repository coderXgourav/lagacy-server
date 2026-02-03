const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['email', 'sms'],
    required: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  subject: {
    type: String
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: Object,
    default: {}
  }
});

module.exports = mongoose.model('Reply', replySchema);
