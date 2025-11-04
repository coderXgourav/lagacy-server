const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth');
const { findBusinesses } = require('../agents/discoveryAgent');
const { enrichWithDomainAge } = require('../agents/domainAgeAgent');
const { filterLegacyWebsites } = require('../agents/filterAgent');
const { enrichWithEmails } = require('../agents/contactFinderAgent');
const Business = require('../models/Business');
const SearchHistory = require('../models/SearchHistory');
const Search = require('../../models/Search');
const SearchResult = require('../../models/SearchResult');
const logger = require('../utils/logger');

router.post('/', authMiddleware, async (req, res) => {
  let search;
  try {
    const userId = req.user._id;
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

    // Create search record first
    search = await Search.create({
      userId,
      query: location,
      searchType: 'location',
      filters: { city, state, country, radius, category: businessCategory, domainYear, filterMode },
      resultsCount: 0,
      status: 'processing',
      apiUsed: 'google'
    });

    // Return searchId immediately so frontend can cancel
    res.json({
      message: 'Search started',
      searchId: search._id
    });

    console.log(`🚀 Search ${search._id} started, processing in background...`);

    // Step 1: Discover businesses
    const category = businessCategory === 'all' ? '' : businessCategory;
    const businesses = await findBusinesses(location, category, radius);
    
    logger.info(`Found ${businesses.length} businesses`);
    
    if (businesses.length === 0) {
      return res.json({ message: 'No businesses found', count: 0, data: [] });
    }

    // Check cancellation
    let freshSearch = await Search.findById(search._id);
    if (freshSearch.cancelRequested) {
      search.status = 'cancelled';
      search.completedAt = new Date();
      await search.save();
      console.log(`🚫 Search cancelled after discovery`);
      return res.json({ message: 'Search cancelled', searchId: search._id });
    }

    // Step 2: Check domain age for all businesses
    const withDomainAge = await enrichWithDomainAge(businesses, search);
    
    logger.info(`Successfully verified ${withDomainAge.length} domains`);

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

    // Check cancellation
    freshSearch = await Search.findById(search._id);
    if (freshSearch.cancelRequested) {
      search.status = 'cancelled';
      search.completedAt = new Date();
      await search.save();
      console.log(`🚫 Search cancelled after domain check`);
      return res.json({ message: 'Search cancelled', searchId: search._id });
    }

    // Step 5: Find contact emails
    const withEmails = await enrichWithEmails(markedBusinesses);

    // Step 6: Save to MongoDB
    const savedBusinesses = [];

    for (let i = 0; i < withEmails.length; i++) {
      // Check cancellation every 10 businesses
      if (i % 10 === 0) {
        freshSearch = await Search.findById(search._id);
        if (freshSearch.cancelRequested) {
          search.status = 'cancelled';
          search.completedAt = new Date();
          await search.save();
          console.log(`🚫 Search cancelled during save at ${i}/${withEmails.length}`);
          return res.json({ message: 'Search cancelled', searchId: search._id });
        }
      }
      
      const business = withEmails[i];
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

    // Update search with results
    search.resultsCount = savedBusinesses.length;
    search.status = 'completed';
    search.completedAt = new Date();
    search.downloadInfo = {
      isDownloadable: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
    await search.save();

    // Store results
    const searchResults = savedBusinesses.map(b => ({
      searchId: search._id,
      userId,
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
        isLegacy: b.isLegacy,
        domainCreationDate: b.domainCreationDate
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

    // Don't send response - already sent at start
    console.log(`✅ Search ${search._id} completed with ${savedBusinesses.length} results`);
  } catch (error) {
    logger.error('Scan failed', error.message);
    
    if (search) {
      search.status = 'failed';
      search.completedAt = new Date();
      await search.save();
    }
    
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
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Scan failed', details: error.message });
    }
  }
});

module.exports = router;
