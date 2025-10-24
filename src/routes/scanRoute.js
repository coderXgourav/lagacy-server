const express = require('express');
const router = express.Router();
const { findBusinesses } = require('../agents/discoveryAgent');
const { enrichWithDomainAge } = require('../agents/domainAgeAgent');
const { filterLegacyWebsites } = require('../agents/filterAgent');
const { enrichWithEmails } = require('../agents/contactFinderAgent');
const Business = require('../models/Business');
const SearchHistory = require('../models/SearchHistory');
const logger = require('../utils/logger');

router.post('/', async (req, res) => {
  try {
    const { city, state, country, radius = 5000, businessCategory, leadCap = 50 } = req.body;

    if (!city || !country) {
      return res.status(400).json({ error: 'City and country are required' });
    }

    const location = state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
    logger.info('Starting scan pipeline', { city, state, country, radius, businessCategory, leadCap });

    // Step 1: Discover businesses
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

    // Save search history
    const searchHistory = new SearchHistory({
      city,
      state,
      country,
      radius,
      businessCategory,
      leadCap,
      resultsCount: savedBusinesses.length,
      status: 'completed'
    });
    await searchHistory.save();

    res.json({
      message: 'Scan complete',
      count: savedBusinesses.length,
      searchId: searchHistory._id,
      data: savedBusinesses
    });
  } catch (error) {
    logger.error('Scan failed', error.message);
    
    // Save failed search history
    try {
      const { city, state, country, radius, businessCategory, leadCap } = req.body;
      if (city && country) {
        const searchHistory = new SearchHistory({
          city, state, country, radius, businessCategory, leadCap,
          resultsCount: 0,
          status: 'failed'
        });
        await searchHistory.save();
      }
    } catch (historyError) {
      logger.error('Failed to save search history', historyError.message);
    }
    
    res.status(500).json({ error: 'Scan failed', details: error.message });
  }
});

module.exports = router;
