const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  apiKeys: {
    whoisxml: {
      type: String,
      default: ''
    },
    hunter: {
      type: String,
      default: ''
    },
    googlePlaces: {
      type: String,
      default: ''
    }
  },
  notifications: {
    email: {
      type: Boolean,
      default: false
    },
    slack: {
      type: Boolean,
      default: false
    }
  },
  exportSettings: {
    autoExport: {
      type: Boolean,
      default: false
    },
    emailRecipients: {
      type: String,
      default: ''
    }
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
