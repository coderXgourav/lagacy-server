const mongoose = require('mongoose');

const newBusinessSchema = new mongoose.Schema({
  searchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewBusinessSearch',
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
  website: String,
  address: String,
  city: String,
  state: String,
  country: String,
  niche: String,
  registrationDate: Date,
  location: {
    lat: Number,
    lng: Number
  },
  osmId: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NewBusiness', newBusinessSchema);
