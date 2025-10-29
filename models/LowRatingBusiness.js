const mongoose = require('mongoose');

const lowRatingBusinessSchema = new mongoose.Schema({
  searchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LowRatingSearch',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  businessName: { type: String, required: true },
  rating: { type: Number, required: true },
  totalReviews: { type: Number, default: 0 },
  phone: String,
  email: String,
  website: String,
  address: String,
  city: String,
  state: String,
  country: String,
  niche: String,
  location: {
    lat: Number,
    lng: Number
  },
  scannedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LowRatingBusiness', lowRatingBusinessSchema);
