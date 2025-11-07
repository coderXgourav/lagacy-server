const LowRatingSearch = require('../models/LowRatingSearch');
const LowRatingBusiness = require('../models/LowRatingBusiness');
const googlePlacesService = require('../services/lowRatingGoogleService.optimized');
const yelpService = require('../services/yelpLowRatingService');
const hunterService = require('../services/hunterService');
const logger = require('../src/utils/logger');

exports.scanForLowRatingBusinesses = async (req, res) => {
  let search;
  try {
    const { city, state, country, radius, niche, maxRating, leads } = req.body;
    const userId = req.user._id;

    if (!city || !country) {
      return res.status(400).json({ success: false, message: 'City and country are required' });
    }

    const ratingThreshold = maxRating || 3.0;
    if (ratingThreshold < 1.0 || ratingThreshold > 5.0) {
      return res.status(400).json({ success: false, message: 'maxRating must be between 1.0 and 5.0' });
    }

    search = await LowRatingSearch.create({
      userId,
      city,
      state,
      country,
      radius: radius || 5000,
      niche,
      maxRating: ratingThreshold,
      leads: leads || 200,
      status: 'processing',
      executedAt: new Date()
    });

    // Return searchId immediately
    res.json({
      message: 'Search started',
      searchId: search._id
    });

    console.log(`🚀 Search ${search._id} started, processing in background...`);
    logger.info(`Starting low rating scan for ${city}, maxRating: ${ratingThreshold}`);

    // Check if cancelled before expensive operation
    let freshSearch = await LowRatingSearch.findById(search._id);
    if (freshSearch.cancelRequested) {
      search.status = 'cancelled';
      search.completedAt = new Date();
      await search.save();
      console.log(`🚫 Search cancelled before API calls`);
      return;
    }

    // Search both Google Places and Yelp in parallel
    const [googleBusinesses, yelpBusinesses] = await Promise.all([
      googlePlacesService.findBusinessesByRating({
        city,
        state,
        country,
        radius: radius || 5000,
        category: niche,
        maxRating: ratingThreshold,
        limit: leads || 200
      }),
      yelpService.findLowRatedBusinesses({
        city,
        state,
        country,
        radius: radius || 5000,
        category: niche,
        maxRating: ratingThreshold,
        limit: 50 // Yelp limit
      })
    ]);

    // Combine and deduplicate by business name + address
    const allBusinesses = [...googleBusinesses, ...yelpBusinesses];
    const uniqueBusinesses = [];
    const seenBusinesses = new Set();
    
    for (const business of allBusinesses) {
      const key = `${business.name.toLowerCase()}-${business.address.toLowerCase()}`;
      if (!seenBusinesses.has(key)) {
        seenBusinesses.add(key);
        uniqueBusinesses.push(business);
      }
    }
    
    const businesses = uniqueBusinesses.slice(0, leads || 200);
    
    logger.success(`Combined results: ${businesses.length} unique businesses (Google: ${googleBusinesses.length}, Yelp: ${yelpBusinesses.length})`);

    // Enrich with Hunter.io emails
    logger.info('Enriching businesses with Hunter.io emails...');
    const enrichedBusinesses = await hunterService.enrichBusinessesWithEmails(businesses, {
      batchSize: 5,
      delayBetweenBatches: 1000,
      skipIfHasEmail: true
    });

    // Check if cancelled before saving
    freshSearch = await LowRatingSearch.findById(search._id);
    if (freshSearch.cancelRequested) {
      search.status = 'cancelled';
      search.completedAt = new Date();
      await search.save();
      console.log(`🚫 Search cancelled after API calls`);
      return;
    }

    const savedBusinesses = [];

    for (let i = 0; i < enrichedBusinesses.length; i++) {
      // Check cancellation every 10 businesses
      if (i % 10 === 0) {
        freshSearch = await LowRatingSearch.findById(search._id);
        if (freshSearch.cancelRequested) {
          search.status = 'cancelled';
          search.completedAt = new Date();
          await search.save();
          console.log(`🚫 Search cancelled during save at ${i}/${enrichedBusinesses.length}`);
          return;
        }
      }
      
      const business = enrichedBusinesses[i];
      try {
        const savedBusiness = await LowRatingBusiness.create({
          searchId: search._id,
          userId,
          businessName: business.name,
          rating: business.rating,
          totalReviews: business.totalReviews,
          phone: business.phone,
          email: business.email,
          website: business.website,
          yelpUrl: business.yelpUrl,
          source: business.source || 'google',
          address: business.address,
          city: business.city || city,
          state: business.state || state,
          country: business.country || country,
          niche: business.category || niche,
          location: business.location
        });

        savedBusinesses.push(savedBusiness);
      } catch (error) {
        logger.error(`Error saving business ${business.name}`, error.message);
      }
    }

    search.resultsCount = savedBusinesses.length;
    search.status = 'completed';
    search.completedAt = new Date();
    await search.save();

    logger.success(`Found ${savedBusinesses.length} businesses with ratings ≤ ${ratingThreshold}`);
    console.log(`✅ Search ${search._id} completed with ${savedBusinesses.length} results`);

  } catch (error) {
    logger.error('Low rating scan failed', error.message);
    if (search) {
      search.status = 'failed';
      search.completedAt = new Date();
      await search.save();
    }
  }
};

exports.getRecentSearches = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;

    const searches = await LowRatingSearch.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, searches, data: searches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSearchResults = async (req, res) => {
  try {
    const { searchId } = req.params;
    const userId = req.user._id;

    const search = await LowRatingSearch.findOne({ _id: searchId, userId });
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }

    const businesses = await LowRatingBusiness.find({ searchId, userId }).lean();

    // Format businesses with both field name formats
    const formattedBusinesses = businesses.map(b => ({
      _id: b._id,
      businessName: b.businessName,
      name: b.businessName, // Alias for compatibility
      rating: b.rating,
      totalReviews: b.totalReviews,
      phone: b.phone,
      email: b.email,
      website: b.website,
      yelpUrl: b.yelpUrl,
      address: b.address,
      city: b.city,
      state: b.state,
      country: b.country,
      niche: b.niche,
      source: b.source
    }));

    res.json({ 
      success: true, 
      data: { 
        search: {
          id: search._id,
          city: search.city,
          state: search.state,
          country: search.country,
          executedAt: search.executedAt,
          resultsCount: search.resultsCount,
          status: search.status
        }, 
        results: formattedBusinesses 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelSearch = async (req, res) => {
  try {
    console.log(`🔴 CANCEL ENDPOINT CALLED for searchId: ${req.params.searchId}`);
    const { searchId } = req.params;
    const userId = req.user._id;
    const search = await LowRatingSearch.findOne({ _id: searchId, userId });
    
    if (!search) {
      console.log(`❌ Search not found: ${searchId}`);
      return res.status(404).json({ success: false, message: 'Search not found' });
    }
    
    console.log(`📊 Current search status: ${search.status}`);
    
    if (search.status === 'completed' || search.status === 'failed') {
      console.log(`⚠️ Search already ${search.status}`);
      return res.json({ success: false, message: 'Search already completed' });
    }
    
    search.cancelRequested = true;
    if (search.status === 'pending') {
      search.status = 'cancelled';
      search.completedAt = new Date();
    }
    await search.save();
    
    console.log(`✅ Cancellation flag set: cancelRequested=true, status=${search.status}`);
    res.json({ success: true, message: 'Cancellation requested' });
  } catch (error) {
    console.log(`❌ Cancel error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSearch = async (req, res) => {
  try {
    const { searchId } = req.params;
    const userId = req.user._id;

    const search = await LowRatingSearch.findOneAndDelete({ _id: searchId, userId });

    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }

    await LowRatingBusiness.deleteMany({ searchId, userId });

    res.json({ success: true, message: 'Search deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
