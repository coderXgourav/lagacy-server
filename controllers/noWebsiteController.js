const NoWebsiteSearch = require('../models/NoWebsiteSearch');
const NoWebsiteBusiness = require('../models/NoWebsiteBusiness');
const { findBusinessesWithoutWebsite, findBusinessesFromFoursquare } = require('../services/noWebsiteGoogleService');
const facebookService = require('../services/facebookService');
const hunterService = require('../services/hunterService');

exports.scanForBusinesses = async (req, res) => {
  let search;
  try {
    const { 
      city, 
      state, 
      country, 
      niche, 
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

    // Fixed radius at 5000 meters (5km)
    const searchRadius = 5000;

    search = await NoWebsiteSearch.create({
      userId,
      city: city || 'Map Location',
      state,
      country: country || 'N/A',
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      radius: searchRadius,
      niche,
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
    console.log(`📧 Hunter.io: ${useHunter ? 'Enabled' : 'Disabled'}`);

    // Get search coordinates (use provided coordinates or geocode location)
    let searchLocation;
    try {
      // Always geocode the typed location if city and country are provided
      // This ensures typed locations take priority over any stale GPS coordinates
      if (city && country) {
        console.log(`🔍 Geocoding typed location: ${city}, ${state || ''}, ${country}`);
        const Settings = require('../models/Settings');
        const axios = require('axios');
        const settings = await Settings.findOne();
        let googleApiKey = settings?.apiKeys?.googlePlaces || process.env.GOOGLE_PLACES_API_KEY;
        if (googleApiKey) googleApiKey = googleApiKey.replace(/["']/g, '').trim();
        
        const locationStr = [city, state, country].filter(Boolean).join(', ');
        const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: { address: locationStr, key: googleApiKey }
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
      console.error('Geocoding failed:', geocodeError.message);
      search.status = 'failed';
      search.completedAt = new Date();
      await search.save();
      return;
    }
    
    // Check if cancelled
    let freshSearch = await NoWebsiteSearch.findById(search._id);
    if (freshSearch.cancelRequested) {
      search.status = 'cancelled';
      search.completedAt = new Date();
      await search.save();
      console.log(`🚫 Search cancelled before API calls`);
      return;
    }

    // Search both Google Places and Foursquare
    // Note: Return ALL results, no lead cap limit
    const [googleBusinesses, foursquareBusinesses] = await Promise.all([
      findBusinessesWithoutWebsite({
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        city,
        state,
        country,
        radius: searchRadius,
        category: niche,
        limit: 999 // Get as many as possible
      }),
      findBusinessesFromFoursquare(searchLocation.lat, searchLocation.lng, niche, searchRadius)
    ]);

    // Check if cancelled after search
    if (req.aborted) {
      search.status = 'cancelled';
      search.completedAt = new Date();
      await search.save();
      return;
    }
    
    // Combine and deduplicate by phone
    console.log(`\n🔀 Combining results from Google Places and Foursquare...`);
    const allBusinesses = [...googleBusinesses, ...foursquareBusinesses];
    const uniqueBusinesses = [];
    const seenPhones = new Set();
    let duplicatesRemoved = 0;
    
    for (const business of allBusinesses) {
      // Return ALL results - no lead cap
      
      const phoneKey = business.phone?.replace(/\D/g, '') || business.name;
      if (!seenPhones.has(phoneKey)) {
        seenPhones.add(phoneKey);
        uniqueBusinesses.push(business);
      } else {
        duplicatesRemoved++;
      }
    }
    
    console.log(`   ✓ Combined: ${allBusinesses.length} total (Google: ${googleBusinesses.length}, Foursquare: ${foursquareBusinesses.length})`);
    console.log(`   ✓ Removed ${duplicatesRemoved} duplicates`);
    console.log(`   ✓ Final unique: ${uniqueBusinesses.length}\n`);
    
    const businesses = uniqueBusinesses;

    if (businesses.length === 0) {
      console.log(`⚠️  No businesses found. Scan complete.\n`);
      search.status = 'completed';
      search.resultsCount = 0;
      await search.save();
      return;
    }

    console.log(`🔍 Step 4: Enriching with Facebook data...`);
    const enrichedBusinesses = [];
    let facebookSuccess = 0;
    let facebookFailed = 0;
    let hunterSuccess = 0;

    for (let i = 0; i < businesses.length; i++) {
      // Check cancellation every 5 businesses
      if (i % 5 === 0) {
        freshSearch = await NoWebsiteSearch.findById(search._id);
        if (freshSearch.cancelRequested) {
          search.status = 'cancelled';
          search.completedAt = new Date();
          await search.save();
          console.log(`🚫 Search cancelled during enrichment at ${i}/${businesses.length}`);
          return;
        }
      }
      
      const business = businesses[i];
      try {
        // Try Facebook API enrichment
        const facebookData = await facebookService.findBusinessPage({
          name: business.name,
          phone: business.phone,
          address: business.address
        });

        // Use social page from Google Places if available, otherwise use Facebook API result
        const finalFacebookPage = business.socialPage?.toLowerCase().includes('facebook') 
          ? business.socialPage 
          : (facebookData?.pageUrl || business.socialPage || null);

        // Try to get email from Hunter if Facebook page exists (only if useHunter is enabled)
        let email = facebookData?.email || null;
        if (useHunter && !email && finalFacebookPage) {
          const fbDomain = finalFacebookPage.match(/facebook\.com\/([^/?]+)/)?.[1];
          if (fbDomain) {
            // Try to find email using business name as domain hint
            const potentialDomain = `${business.name.toLowerCase().replace(/\s+/g, '')}.com`;
            const emails = await hunterService.findEmailsByDomain(potentialDomain);
            if (emails.length > 0) {
              email = emails[0];
              hunterSuccess++;
            }
          }
        }

        const savedBusiness = await NoWebsiteBusiness.create({
          searchId: search._id,
          userId,
          ownerName: facebookData?.ownerName || null,
          businessName: business.name,
          phone: business.phone,
          email: email,
          facebookPage: finalFacebookPage,
          address: business.address,
          city: city,
          state: state,
          country: country,
          niche: business.category || niche,
          rating: business.rating || null,
          location: business.location
        });

        enrichedBusinesses.push(savedBusiness);
        if (facebookData) facebookSuccess++;
        
        console.log(`   [${i + 1}/${businesses.length}] ✓ ${business.name} ${facebookData ? '(Facebook data found)' : ''} ${email ? '(Email found)' : ''}`);
      } catch (error) {
        facebookFailed++;
        console.log(`   [${i + 1}/${businesses.length}] ⚠️  ${business.name} (Enrichment failed)`);
        
        const savedBusiness = await NoWebsiteBusiness.create({
          searchId: search._id,
          userId,
          businessName: business.name,
          phone: business.phone,
          facebookPage: business.socialPage || null,
          address: business.address,
          city: city,
          state: state,
          country: country,
          niche: business.category || niche,
          rating: business.rating || null,
          location: business.location
        });
        enrichedBusinesses.push(savedBusiness);
      }
    }
    
    console.log(`\n   ✓ Enrichment complete: ${facebookSuccess} with Facebook data, ${facebookFailed} without, ${hunterSuccess} with Hunter emails\n`);

    search.resultsCount = enrichedBusinesses.length;
    search.status = 'completed';
    search.completedAt = new Date();
    await search.save();

    console.log(`${'='.repeat(80)}`);
    console.log(`✅ SCAN COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 Final Results:`);
    console.log(`   - Total businesses saved: ${enrichedBusinesses.length}`);
    console.log(`   - From Google Places: ${googleBusinesses.length}`);
    console.log(`   - From Foursquare: ${foursquareBusinesses.length}`);
    console.log(`   - With Facebook/social data: ${enrichedBusinesses.filter(b => b.facebookPage).length}`);
    console.log(`   - With email: ${enrichedBusinesses.filter(b => b.email).length}`);
    console.log(`   - With owner name: ${enrichedBusinesses.filter(b => b.ownerName).length}`);
    console.log(`   - Search ID: ${search._id}`);
    console.log(`${'='.repeat(80)}\n`);

    console.log(`✅ Search ${search._id} completed with ${enrichedBusinesses.length} results`);

  } catch (error) {
    console.error('Scan error:', error);
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

    const searches = await NoWebsiteSearch.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: searches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getSearchResults = async (req, res) => {
  try {
    const { searchId } = req.params;
    const { page = 1, limit = 999 } = req.query;
    const userId = req.user._id;

    const search = await NoWebsiteSearch.findOne({ _id: searchId, userId });
    if (!search) {
      return res.status(404).json({
        success: false,
        message: 'Search not found'
      });
    }

    const businesses = await NoWebsiteBusiness.find({ 
      searchId, 
      userId 
    })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

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
        results: businesses
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.cancelSearch = async (req, res) => {
  try {
    const { searchId } = req.params;
    const userId = req.user._id;
    const search = await NoWebsiteSearch.findOne({ _id: searchId, userId });
    
    if (!search) return res.status(404).json({ success: false, message: 'Search not found' });
    if (search.status === 'completed' || search.status === 'failed') {
      return res.json({ success: false, message: 'Search already completed' });
    }
    
    search.cancelRequested = true;
    if (search.status === 'pending') {
      search.status = 'cancelled';
      search.completedAt = new Date();
    }
    await search.save();
    
    console.log(`🚫 Cancellation requested for search ${search._id}`);
    res.json({ success: true, message: 'Cancellation requested' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSearch = async (req, res) => {
  try {
    const { searchId } = req.params;
    const userId = req.user._id;

    const search = await NoWebsiteSearch.findOneAndDelete({ 
      _id: searchId, 
      userId 
    });

    if (!search) {
      return res.status(404).json({
        success: false,
        message: 'Search not found'
      });
    }

    await NoWebsiteBusiness.deleteMany({ searchId, userId });

    res.json({
      success: true,
      message: 'Search deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
