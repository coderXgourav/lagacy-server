const mongoose = require('mongoose');

const scrapedDomainSchema = new mongoose.Schema({
  domainName: {
    type: String,
    required: true,
    unique: true
  },
  tld: String,
  registrationDate: Date,
  registrant: {
    name: String,
    email: String,
    phone: String,
    organization: String,
    country: String,
    address: String
  },
  nameservers: [String],
  status: String,
  sourceUrl: String,
  sourceDate: {
    type: String,
    index: true
  },
  enrichmentSource: {
    type: String,
    enum: ['RDAP', 'WhoisFreaks', 'WhoisXML', 'CSV'],
    default: 'CSV'
  },
  scrapedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

scrapedDomainSchema.index({ sourceDate: 1 });

module.exports = mongoose.model('ScrapedDomain', scrapedDomainSchema);
