const mongoose = require('mongoose');

const noWebsiteBusinessSchema = new mongoose.Schema({
  searchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NoWebsiteSearch',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ownerName: String,
  businessName: { type: String, required: true },
  phone: String,
  email: String,
  facebookPage: String, // Can store any social media URL (Facebook, Zomato, Instagram, etc.)
  address: String,
  city: String,
  state: String,
  country: String,
  niche: String,
  rating: Number,
  location: {
    lat: Number,
    lng: Number
  },
  scannedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NoWebsiteBusiness', noWebsiteBusinessSchema);
