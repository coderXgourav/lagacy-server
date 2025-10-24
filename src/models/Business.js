const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  category: String,
  phone: String,
  address: String,
  website: { type: String, required: true },
  domainCreationDate: String,
  isLegacy: { type: Boolean, default: false },
  emails: [String],
  location: {
    city: String,
    state: String,
    country: String
  },
  scannedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Business', businessSchema);
