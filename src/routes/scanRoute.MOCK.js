const express = require('express');
const router = express.Router();
// FORCE MOCK MODE - No Google API needed
const { findBusinesses } = require('../agents/discoveryAgent.mock');
const { enrichWithDomainAge } = require('../agents/domainAgeAgent');
const { filterLegacyWebsites } = require('../agents/filterAgent');
const { enrichWithEmails } = require('../agents/contactFinderAgent');
const Business = require('../models/Business');
const logger = require('../utils/logger');

router.post('/', async (req, res) => {
  try {
    const { city, state, country, radius = 5000, businessCategory, leadCap = 50 } = req.body;

    if (!city || !country) {
      return res.status(400).json({ error: 'City and country are required' });
    }

    const location = state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
    logger.info('Starting scan pipeline (MOCK MODE)', { city, state, country, radius, businessCategory, leadCap });

    // Step 1: Discover businesses (MOCK DATA)
    let businesses = await findBusinesses(location, businessCategory, radius);
    
    // Apply lead cap
    if (businesses.length > leadCap) {
      businesses = businesses.slice(0, leadCap);
      logger.info(`Applied lead cap: ${leadCap} businesses`);
    }
    
    if (businesses.length === 0) {
      return res.json({ message: 'No businesses found', count: 0, data: [] });
    }

    // Step 2: Check domain age
    const withDomainAge = await enrichWithDomainAge(businesses);

    // Step 3: Filter legacy websites
    const legacyWebsites = filterLegacyWebsites(withDomainAge);

    if (legacyWebsites.length === 0) {
      return res.json({ message: 'No legacy websites found', count: 0, data: [] });
    }

    // Step 4: Find contact emails
    const withEmails = await enrichWithEmails(legacyWebsites);

    // Step 5: Save to MongoDB
    const savedBusinesses = [];

    for (const business of withEmails) {
      const businessDoc = new Business({
        businessName: business.name,
        category: business.category,
        phone: business.phone,
        address: business.address,
        website: business.website,
        domainCreationDate: business.creationDate,
        isLegacy: business.isLegacy,
        emails: business.emails,
        location: { city, state: state || '', country }
      });

      await businessDoc.save();
      savedBusinesses.push(businessDoc);
    }

    logger.success(`Scan complete. Saved ${savedBusinesses.length} legacy businesses`);

    res.json({
      message: 'Scan complete',
      count: savedBusinesses.length,
      data: savedBusinesses
    });
  } catch (error) {
    logger.error('Scan failed', error.message);
    res.status(500).json({ error: 'Scan failed', details: error.message });
  }
});

module.exports = router;
