const NoWebsiteSearch = require('../models/NoWebsiteSearch');
const NoWebsiteBusiness = require('../models/NoWebsiteBusiness');
const { findBusinessesWithoutWebsite, findBusinessesFromFoursquare } = require('../services/noWebsiteGoogleService');
const facebookService = require('../services/facebookService');

exports.scanForBusinesses = async (req, res) => {
  let search;
  try {
    const { city, state, country, radius, niche, leads } = req.body;
    const userId = req.user._id;

    search = await NoWebsiteSearch.create({
      userId,
      city,
      state,
      country,
      radius,
      niche,
      leads,
      status: 'processing',
      executedAt: new Date()
    });

    // Return searchId immediately
    res.json({
      message: 'Search started',
      searchId: search._id
    });

    console.log(`🚀 Search ${search._id} started, processing in background...`);

    // Get coordinates for Foursquare
    const Settings = require('../models/Settings');
    const axios = require('axios');
    const settings = await Settings.findOne();
    let googleApiKey = settings?.apiKeys?.googlePlaces || process.env.googlePlaces;
    if (googleApiKey) googleApiKey = googleApiKey.replace(/["']/g, '').trim();
    
    const locationStr = [city, state, country].filter(Boolean).join(', ');
    const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: locationStr, key: googleApiKey }
    });
    const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
    
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
    const [googleBusinesses, foursquareBusinesses] = await Promise.all([
      findBusinessesWithoutWebsite({
        city,
        state,
        country,
        radius,
        category: niche,
        limit: leads
      }),
      findBusinessesFromFoursquare(lat, lng, niche, radius)
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
      if (uniqueBusinesses.length >= leads) break;
      
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

        const savedBusiness = await NoWebsiteBusiness.create({
          searchId: search._id,
          userId,
          ownerName: facebookData?.ownerName || null,
          businessName: business.name,
          phone: business.phone,
          email: facebookData?.email || null,
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
        
        console.log(`   [${i + 1}/${businesses.length}] ✓ ${business.name} ${facebookData ? '(Facebook data found)' : ''}`);
      } catch (error) {
        facebookFailed++;
        console.log(`   [${i + 1}/${businesses.length}] ⚠️  ${business.name} (Facebook enrichment failed)`);
        
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
    
    console.log(`\n   ✓ Enrichment complete: ${facebookSuccess} with Facebook data, ${facebookFailed} without\n`);

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
    }).lean();

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
