const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  company: {
    type: String,
    default: ''
  },
  website: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  country: {
    type: String,
    default: ''
  },
  zipCode: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: ''
  },
  industry: {
    type: String,
    default: ''
  },
  domainAge: {
    type: Number,
    default: null
  },
  registrar: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    enum: ['whoisxml', 'hunter', 'google', 'manual', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'closed', 'lost'],
    default: 'new'
  },
  notes: {
    type: String,
    default: ''
  },
  searchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Search'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Lead', leadSchema);
