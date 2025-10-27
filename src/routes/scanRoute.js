const express = require('express');
const router = express.Router();
const { findBusinesses } = require('../agents/discoveryAgent');
const { enrichWithDomainAge } = require('../agents/domainAgeAgent');
const { filterLegacyWebsites } = require('../agents/filterAgent');
const { enrichWithEmails } = require('../agents/contactFinderAgent');
const Business = require('../models/Business');
const SearchHistory = require('../models/SearchHistory');
const Search = require('../../models/Search');
const SearchResult = require('../../models/SearchResult');
const logger = require('../utils/logger');

router.post('/', async (req, res) => {
  try {
    const { city, state, country, radius = 5000, businessCategory, leadCap = 50, domainYear, filterMode = 'before' } = req.body;

    if (!city || !country) {
      return res.status(400).json({ error: 'City and country are required' });
    }

    // Calculate domain date filter
    let domainDateFilter = null;
    if (domainYear) {
      domainDateFilter = new Date(`${domainYear}-01-01`);
    }

    const location = state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
    logger.info('Starting scan pipeline', { city, state, country, radius, businessCategory, leadCap, domainDateFilter });

    // Step 1: Discover businesses
    const category = businessCategory === 'all' ? '' : businessCategory;
    let businesses = await findBusinesses(location, category, radius);
    
    // Filter out government, big tech, and major MNCs
    const excludeTypes = [
      'government', 'local_government_office', 'city_hall', 'embassy', 'courthouse', 'police', 'fire_station',
      'lawyer', 'law_firm', 'accounting', 'insurance_agency', 'real_estate_agency', 'finance'
    ];
    const excludeDomains = [
      'google.com', 'facebook.com', 'microsoft.com', 'amazon.com', 'apple.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'youtube.com',
      'mcdonalds.com', 'starbucks.com', 'subway.com', 'kfc.com', 'pizzahut.com', 'dominos.com', 'burgerking.com', 'wendys.com',
      'walmart.com', 'target.com', 'costco.com', 'ikea.com', 'homedepot.com', 'lowes.com',
      'marriott.com', 'hilton.com', 'hyatt.com', 'ihg.com', 'accor.com',
      'nike.com', 'adidas.com', 'gap.com', 'hm.com', 'zara.com', 'uniqlo.com',
      'shell.com', 'bp.com', 'exxon.com', 'chevron.com',
      'coca-cola.com', 'pepsi.com', 'nestle.com', 'unilever.com', 'pg.com',
      'jpmorgan.com', 'bankofamerica.com', 'wellsfargo.com', 'citigroup.com', 'hsbc.com',
      'tata.com', 'relianceindustries.com', 'adityabirla.com', 'mahindra.com', 'infosys.com', 'tcs.com', 'wipro.com', 'hcl.com',
      'bharti.com', 'airtel.in', 'jio.com', 'vodafone.in',
      'sbi.co.in', 'hdfcbank.com', 'icicibank.com', 'axisbank.com', 'pnb.co.in',
      'bigbazaar.com', 'dmart.in', 'reliance.com', 'spencers.in', 'more.in',
      'haldirams.com', 'bikanervala.com', 'nirulas.com', 'saravanaabhavan.com',
      'gov', '.gov.', 'edu', '.edu.', 'nic.in', '.ac.in'
    ];
    const excludeNames = [
      'mcdonalds', 'starbucks', 'subway', 'kfc', 'pizza hut', 'dominos', 'burger king', 'walmart', 'target', 'costco', 'ikea',
      'tata', 'reliance', 'aditya birla', 'mahindra', 'infosys', 'tcs', 'wipro', 'hcl',
      'airtel', 'jio', 'vodafone', 'idea',
      'state bank', 'hdfc', 'icici', 'axis bank', 'punjab national',
      'big bazaar', 'dmart', 'spencers', 'more supermarket',
      'haldiram', 'bikanervala', 'nirula', 'saravana bhavan', 'udupi',
      'cafe coffee day', 'barista', 'costa coffee',
      'pvr', 'inox', 'cinepolis',
      'apollo', 'fortis', 'max healthcare', 'manipal',
      'law firm', 'attorney', 'advocate', 'legal', 'chartered accountant', 'ca firm', 'insurance', 'real estate'
    ];
    
    businesses = businesses.filter(b => {
      const lowerName = b.name.toLowerCase();
      const hasExcludedType = b.category && excludeTypes.some(type => b.category.includes(type));
      const hasExcludedDomain = excludeDomains.some(domain => b.website.includes(domain));
      const hasExcludedName = excludeNames.some(name => lowerName.includes(name));
      
      // Additional check for professional services keywords
      const professionalKeywords = ['law', 'legal', 'attorney', 'advocate', 'chartered', 'insurance', 'realty'];
      const isProfessionalService = professionalKeywords.some(keyword => lowerName.includes(keyword));
      
      return !hasExcludedType && !hasExcludedDomain && !hasExcludedName && !isProfessionalService;
    });
    
    logger.info(`Filtered to ${businesses.length} businesses after excluding government/big tech`);
    
    if (businesses.length === 0) {
      return res.json({ message: 'No businesses found', count: 0, data: [] });
    }

    // Step 2: Check domain age (process more than leadCap to account for failures)
    const processLimit = Math.min(businesses.length, leadCap * 3);
    const withDomainAge = await enrichWithDomainAge(businesses.slice(0, processLimit));
    
    logger.info(`Successfully verified ${withDomainAge.length} domains out of ${processLimit} businesses`);

    // Step 3: Filter by domain date if specified
    let filteredByDate = withDomainAge;
    if (domainDateFilter) {
      filteredByDate = withDomainAge.filter(b => {
        const domainDate = new Date(b.creationDate);
        if (filterMode === 'after') {
          return domainDate >= domainDateFilter; // After: show NEW domains
        } else {
          return domainDate < domainDateFilter; // Before: show OLD domains
        }
      });
      logger.info(`Filtered to ${filteredByDate.length} businesses by domain date`);
    }

    // Step 4: Mark as legacy based on filter mode
    let markedBusinesses = filteredByDate.map(b => ({
      ...b,
      isLegacy: filterMode === 'before'
    }));

    if (markedBusinesses.length === 0) {
      return res.json({ message: 'No businesses found after filtering', count: 0, data: [] });
    }
    
    // Apply lead cap after all filtering
    if (markedBusinesses.length > leadCap) {
      markedBusinesses = markedBusinesses.slice(0, leadCap);
      logger.info(`Applied lead cap: ${leadCap} businesses`);
    }

    // Step 5: Find contact emails
    const withEmails = await enrichWithEmails(markedBusinesses);

    // Step 6: Save to MongoDB
    const savedBusinesses = [];

    for (const business of withEmails) {
      const businessDoc = new Business({
        businessName: business.name,
        category: business.category,
        phone: business.phone,
        address: business.address,
        website: business.website,
        domainCreationDate: business.creationDate,
        ownerName: business.ownerName,
        isLegacy: business.isLegacy,
        emails: business.emails,
        location: { city, state: state || '', country }
      });

      await businessDoc.save();
      savedBusinesses.push(businessDoc);
    }

    logger.success(`Scan complete. Saved ${savedBusinesses.length} legacy businesses`);

    // Save to new Search model
    const search = await Search.create({
      query: location,
      searchType: 'location',
      filters: { city, state, country, radius, category: businessCategory, domainYear, filterMode },
      resultsCount: savedBusinesses.length,
      status: 'completed',
      apiUsed: 'google',
      downloadInfo: {
        isDownloadable: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    // Store results
    const searchResults = savedBusinesses.map(b => ({
      searchId: search._id,
      businessData: {
        name: b.businessName,
        website: b.website,
        email: b.emails?.[0] || '',
        phone: b.phone,
        address: b.address,
        city: b.location.city,
        state: b.location.state,
        country: b.location.country,
        category: b.category,
        ownerName: b.ownerName,
        isLegacy: b.isLegacy
      },
      metadata: { source: 'google' }
    }));
    await SearchResult.insertMany(searchResults);

    // Save legacy search history
    const searchHistory = new SearchHistory({
      city, state, country, radius, businessCategory, leadCap,
      resultsCount: savedBusinesses.length,
      status: 'completed'
    });
    await searchHistory.save();

    res.json({
      message: 'Scan complete',
      count: savedBusinesses.length,
      searchId: search._id,
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
