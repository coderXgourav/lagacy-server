const mongoose = require('mongoose');

const newDomainSchema = new mongoose.Schema({
  searchId: { type: mongoose.Schema.Types.ObjectId, ref: 'NewDomainSearch', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  domainName: { type: String, required: true, index: true },
  registrationDate: { type: Date, required: true },
  tld: { type: String, required: true },
  registrant: {
    name: String,
    email: String,
    phone: String,
    organization: String,
    address: String,
    city: String,
    state: String,
    country: String
  },
  nameservers: [String],
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NewDomain', newDomainSchema);
