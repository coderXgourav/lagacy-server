const LowRatingSearch = require('../models/LowRatingSearch');
const LowRatingBusiness = require('../models/LowRatingBusiness');
const googlePlacesService = require('../services/lowRatingGoogleService.optimized');
const yelpService = require('../services/yelpLowRatingService');
const hunterService = require('../services/hunterService');
const logger = require('../src/utils/logger');

exports.scanForLowRatingBusinesses = async (req, res) => {
  let search;
  try {
    const { 
      city, 
      state, 
      country, 
      niche, 
      maxRating, 
      lat,              // NEW: Optional coordinates from map
      lng,              // NEW: Optional coordinates from map
      useHunter = true  // NEW: Enable/disable Hunter.io (default true)
    } = req.body;
    const userId = req.user._id;

    // Validate: Need either city/country (preferred) OR coordinates
    if (!city && !country && (!lat || !lng)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Location required: provide city/country or coordinates (lat/lng)' 
      });
    }

    const ratingThreshold = maxRating || 3.0;
    if (ratingThreshold < 1.0 || ratingThreshold > 5.0) {
      return res.status(400).json({ success: false, message: 'maxRating must be between 1.0 and 5.0' });
    }

    // Fixed radius at 5000 meters (5km)
    const searchRadius = 5000;

    search = await LowRatingSearch.create({
      userId,
      city: city || 'Map Location',
      state,
      country: country || 'N/A',
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      radius: searchRadius,
      niche,
      maxRating: ratingThreshold,
      useHunter,
      status: 'processing',
      executedAt: new Date()
    });

    // Return searchId immediately
    res.json({
      message: 'Search started',
      searchId: search._id
    });

    console.log(`🚀 Search ${search._id} started, processing in background...`);
    logger.info(`Starting low rating scan, maxRating: ${ratingThreshold}, useHunter: ${useHunter}`);

    // Get search coordinates (use provided coordinates or geocode location)
    let searchLocation;
    try {
      // Always geocode the typed location if city and country are provided
      // This ensures typed locations take priority over any stale GPS coordinates
      if (city && country) {
        console.log(`🔍 Geocoding typed location: ${city}, ${state || ''}, ${country}`);
        const axios = require('axios');
        const Settings = require('../models/Settings');
        const settings = await Settings.findOne();
        let apiKey = settings?.apiKeys?.googlePlaces || process.env.GOOGLE_PLACES_API_KEY;
        if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();
        
        const addressParts = [city, state, country].filter(Boolean);
        const address = addressParts.join(', ');
        
        const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: { address, key: apiKey }
        });
        
        if (!geocodeResponse.data.results || geocodeResponse.data.results.length === 0) {
          throw new Error('Location not found');
        }
        
        const location = geocodeResponse.data.results[0]?.geometry?.location;
        if (!location) {
          throw new Error('Invalid geocoding response');
        }
        
        searchLocation = { lat: location.lat, lng: location.lng };
        console.log(`✅ Geocoded to: ${searchLocation.lat}, ${searchLocation.lng}`);
      } else if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        // Fallback: Use coordinates from map only if no city/country provided
        searchLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
        console.log(`📍 Using map coordinates: ${searchLocation.lat}, ${searchLocation.lng}`);
      } else {
        throw new Error('No location information provided');
      }
    } catch (geocodeError) {
      logger.error('Geocoding failed', geocodeError.message);
      search.status = 'failed';
      search.completedAt = new Date();
      await search.save();
      return;
    }

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
    // Note: Return ALL results, no lead cap limit
    const [googleBusinesses, yelpBusinesses] = await Promise.all([
      googlePlacesService.findBusinessesByRating({
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        city,
        state,
        country,
        radius: searchRadius,
        category: niche,
        maxRating: ratingThreshold,
        limit: 999 // Get as many as possible from Google
      }),
      yelpService.findLowRatedBusinesses({
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        city,
        state,
        country,
        radius: searchRadius,
        category: niche,
        maxRating: ratingThreshold,
        limit: 50 // Yelp API limit
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
    
    // Return ALL results - no lead cap limit
    const businesses = uniqueBusinesses;
    
    logger.success(`Combined results: ${businesses.length} unique businesses (Google: ${googleBusinesses.length}, Yelp: ${yelpBusinesses.length})`);

    // Enrich with Hunter.io emails (only if enabled)
    let enrichedBusinesses = businesses;
    if (useHunter) {
      logger.info('Enriching businesses with Hunter.io emails...');
      enrichedBusinesses = await hunterService.enrichBusinessesWithEmails(businesses, {
        batchSize: 5,
        delayBetweenBatches: 1000,
        skipIfHasEmail: true
      });
    } else {
      logger.info('Hunter.io enrichment disabled by user');
    }

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
    const { page = 1, limit = 999 } = req.query;
    const userId = req.user._id;

    const search = await LowRatingSearch.findOne({ _id: searchId, userId });
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }

    const businesses = await LowRatingBusiness.find({ searchId, userId })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

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
