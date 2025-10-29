const axios = require('axios');
const Settings = require('../models/Settings');

async function searchGoogleGridNoWebsite(lat, lng, businessCategory, radius, apiKey, seenPlaceIds, leadLimit, minRating = null, maxRating = null) {
  const businesses = [];
  let nextPageToken = null;
  let pageCount = 0;
  const maxPages = 3;
  
  do {
    if (businesses.length >= leadLimit) break;
    
    const params = { location: `${lat},${lng}`, radius: radius, key: apiKey };
    if (businessCategory) params.keyword = businessCategory;
    // Note: Don't use min_rating in params - Google API doesn't support it reliably
    if (nextPageToken) {
      params.pagetoken = nextPageToken;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', { params });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.log(`   ⚠️  API returned status: ${response.data.status}`);
      break;
    }
    
    const totalPlaces = response.data.results?.length || 0;
    console.log(`      Found ${totalPlaces} places in this page`);
  
    for (const place of response.data.results || []) {
      if (businesses.length >= leadLimit) break;
      
      if (seenPlaceIds.has(place.place_id)) continue;
      seenPlaceIds.add(place.place_id);
      
      const detailsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
        params: {
          place_id: place.place_id,
          fields: 'name,formatted_address,formatted_phone_number,website,types,geometry',
          key: apiKey
        }
      });

      const details = detailsResponse.data.result;
      
      // Check if website is actually a social media page
      const socialMediaDomains = [
        'facebook.com',
        'instagram.com',
        'twitter.com',
        'linkedin.com',
        'youtube.com',
        'zomato.com',
        'swiggy.com',
        'ubereats.com',
        'yelp.com',
        'tripadvisor.com'
      ];
      
      let isSocialMedia = false;
      let socialPage = null;
      
      if (details.website) {
        const websiteLower = details.website.toLowerCase();
        isSocialMedia = socialMediaDomains.some(domain => websiteLower.includes(domain));
        if (isSocialMedia) {
          socialPage = details.website;
        }
      }
      
      // Include if NO website OR website is social media page
      if (!details.website || isSocialMedia) {
        console.log(`         ✓ ${details.name}: ${!details.website ? 'NO WEBSITE' : 'Social: ' + socialPage}`);
        businesses.push({
          name: details.name,
          address: details.formatted_address,
          phone: details.formatted_phone_number || '',
          category: details.types?.[0] || businessCategory || 'general',
          socialPage: socialPage,
          rating: place.rating || 0,
          location: {
            lat: details.geometry.location.lat,
            lng: details.geometry.location.lng
          }
        });
      } else {
        console.log(`         ✗ ${details.name}: Has real website`);
      }
    }
    
    nextPageToken = response.data.next_page_token;
    pageCount++;
    
  } while (nextPageToken && pageCount < maxPages && businesses.length < leadLimit);
  
  return businesses;
}

async function findBusinessesWithoutWebsite({ city, state, country, radius, category, limit }) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[NO-WEBSITE SCAN] Starting scan for businesses WITHOUT websites`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📍 Location: ${city}${state ? ', ' + state : ''}, ${country}`);
    console.log(`📏 Radius: ${radius}m`);
    console.log(`🏷️  Category: ${category || 'All businesses'}`);
    console.log(`🎯 Lead Limit: ${limit}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.googlePlaces || process.env.googlePlaces;
    if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();
    
    if (!apiKey) {
      throw new Error('Google Places API key not configured');
    }
    
    // Geocode location
    console.log(`🗺️  Step 1: Geocoding location...`);
    const locationStr = [city, state, country].filter(Boolean).join(', ');
    const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: locationStr, key: apiKey }
    });
    
    if (geocodeResponse.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${geocodeResponse.data.status}`);
    }
    
    const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
    console.log(`   ✓ Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}\n`);
    
    console.log(`🔍 Step 2: Starting 16-grid search strategy...`);
    // 16-grid search strategy (same as legacy page)
    const innerOffset = (radius * 0.4) / 111320;
    const outerOffset = (radius * 0.7) / 111320;
    const gridRadius = Math.floor(radius * 0.45);
    
    const gridPoints = [
      { lat, lng, name: 'Center', radius: gridRadius },
      { lat: lat + innerOffset, lng, name: 'N', radius: gridRadius },
      { lat: lat - innerOffset, lng, name: 'S', radius: gridRadius },
      { lat, lng: lng + innerOffset, name: 'E', radius: gridRadius },
      { lat, lng: lng - innerOffset, name: 'W', radius: gridRadius },
      { lat: lat + innerOffset, lng: lng + innerOffset, name: 'NE', radius: gridRadius },
      { lat: lat + innerOffset, lng: lng - innerOffset, name: 'NW', radius: gridRadius },
      { lat: lat - innerOffset, lng: lng + innerOffset, name: 'SE', radius: gridRadius },
      { lat: lat - innerOffset, lng: lng - innerOffset, name: 'SW', radius: gridRadius },
      { lat: lat + outerOffset, lng, name: 'N2', radius: gridRadius },
      { lat: lat - outerOffset, lng, name: 'S2', radius: gridRadius },
      { lat, lng: lng + outerOffset, name: 'E2', radius: gridRadius },
      { lat, lng: lng - outerOffset, name: 'W2', radius: gridRadius },
      { lat: lat + outerOffset, lng: lng + outerOffset, name: 'NE2', radius: gridRadius },
      { lat: lat + outerOffset, lng: lng - outerOffset, name: 'NW2', radius: gridRadius },
      { lat: lat - outerOffset, lng: lng + outerOffset, name: 'SE2', radius: gridRadius }
    ];
    
    const seenPlaceIds = new Set();
    let noWebsiteCount = 0;
    let socialMediaCount = 0;
    
    console.log(`   ⚡ Searching all 16 grids in parallel for maximum speed...\n`);
    
    // Parallel search: All 16 grids at once
    const gridSearchPromises = gridPoints.map(point => 
      searchGoogleGridNoWebsite(
        point.lat,
        point.lng,
        category,
        point.radius,
        apiKey,
        seenPlaceIds,
        limit,
        null, // No rating filter for parallel search
        null
      ).then(results => ({ point, results }))
    );
    
    const gridSearchResults = await Promise.all(gridSearchPromises);
    
    // Process results from all grids
    const allBusinesses = [];
    const gridRatings = [];
    
    for (let i = 0; i < gridSearchResults.length; i++) {
      const { point, results: gridResults } = gridSearchResults[i];
      
      // Calculate average rating for this grid
      const ratingsInGrid = gridResults.filter(b => b.rating > 0).map(b => b.rating);
      const avgRating = ratingsInGrid.length > 0
        ? (ratingsInGrid.reduce((a, b) => a + b, 0) / ratingsInGrid.length).toFixed(2)
        : 0;
      
      gridRatings.push({ grid: i + 1, avgRating: parseFloat(avgRating), count: gridResults.length });
      allBusinesses.push(...gridResults);
      
      // Count social media vs no website
      const socialInGrid = gridResults.filter(b => b.socialPage).length;
      const noWebInGrid = gridResults.length - socialInGrid;
      
      const ratingInfo = avgRating > 0 ? ` | Avg rating: ${avgRating}` : '';
      
      console.log(`   Grid ${point.name.padEnd(6)} (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}): ${gridResults.length} businesses | No web: ${noWebInGrid} | Social: ${socialInGrid}${ratingInfo}`);
      
      noWebsiteCount += noWebInGrid;
      socialMediaCount += socialInGrid;
    }
    
    // Calculate overall rating distribution
    const finalAvgRating = allBusinesses.filter(b => b.rating > 0).length > 0
      ? (allBusinesses.filter(b => b.rating > 0).reduce((a, b) => a + b.rating, 0) / allBusinesses.filter(b => b.rating > 0).length).toFixed(2)
      : 0;
    const finalRatings = allBusinesses.filter(b => b.rating > 0).map(b => b.rating);
    
    console.log(`\n   ✓ Grid search complete: ${allBusinesses.length} total businesses found`);
    console.log(`     - ${noWebsiteCount} with NO website at all`);
    console.log(`     - ${socialMediaCount} with social media only`);
    console.log(`     - Overall avg rating: ${finalAvgRating}`);
    if (finalRatings.length > 0) {
      console.log(`     - Rating range: ${Math.min(...finalRatings).toFixed(1)} - ${Math.max(...finalRatings).toFixed(1)}`);
    }
    console.log();
    
    console.log(`🛡️  Step 3: Deduplicating by phone number...`);
    // Deduplicate by phone number
    const uniqueBusinesses = [];
    const seenPhones = new Set();
    let duplicatesRemoved = 0;
    
    for (const business of allBusinesses) {
      if (uniqueBusinesses.length >= limit) break;
      
      const phoneKey = business.phone?.replace(/\D/g, '') || business.name;
      if (!seenPhones.has(phoneKey)) {
        seenPhones.add(phoneKey);
        uniqueBusinesses.push(business);
      } else {
        duplicatesRemoved++;
      }
    }

    console.log(`   ✓ Removed ${duplicatesRemoved} duplicates`);
    console.log(`   ✓ Final unique businesses: ${uniqueBusinesses.length}\n`);
    
    const finalResults = uniqueBusinesses.slice(0, limit);
    
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ DISCOVERY COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 Results Summary:`);
    console.log(`   - Total scanned: ${allBusinesses.length}`);
    console.log(`   - After deduplication: ${uniqueBusinesses.length}`);
    console.log(`   - Returning (lead cap): ${finalResults.length}`);
    console.log(`   - Businesses with no website: ${finalResults.filter(b => !b.socialPage).length}`);
    console.log(`   - Businesses with social media only: ${finalResults.filter(b => b.socialPage).length}`);
    console.log(`${'='.repeat(80)}\n`);
    
    return finalResults;
  } catch (error) {
    console.error('Google Places error:', error);
    throw error;
  }
}

async function findBusinessesFromFoursquare(lat, lng, category, radius) {
  try {
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.foursquare || process.env.FOURSQUARE_API_KEY;
    if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();
    
    if (!apiKey) {
      console.log('   ⚠️  No Foursquare API key configured, skipping\n');
      return [];
    }
    
    console.log(`\n🔍 Step 5: Searching Foursquare for additional businesses...`);
    
    const params = {
      ll: `${lat},${lng}`,
      radius: radius,
      limit: 50
    };
    if (category) params.query = category;
    
    const response = await axios.get('https://places-api.foursquare.com/places/search', {
      params,
      headers: {
        'X-Places-Api-Version': '2025-06-17',
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`
      }
    });
    
    const businesses = [];
    const socialMediaDomains = [
      'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
      'youtube.com', 'zomato.com', 'swiggy.com', 'ubereats.com',
      'yelp.com', 'tripadvisor.com'
    ];
    
    for (const place of response.data.results || []) {
      let isSocialMedia = false;
      let socialPage = null;
      
      if (place.website) {
        const websiteLower = place.website.toLowerCase();
        isSocialMedia = socialMediaDomains.some(domain => websiteLower.includes(domain));
        if (isSocialMedia) {
          socialPage = place.website;
        }
      }
      
      // Include if NO website OR website is social media
      if (!place.website || isSocialMedia) {
        businesses.push({
          name: place.name,
          address: place.location?.formatted_address || `${place.location?.address || ''}, ${place.location?.locality || ''}`,
          phone: place.tel || '',
          category: place.categories?.[0]?.name || category || 'general',
          socialPage: socialPage,
          location: {
            lat: place.geocodes?.main?.latitude,
            lng: place.geocodes?.main?.longitude
          }
        });
      }
    }
    
    console.log(`   ✓ Foursquare: Found ${businesses.length} businesses without websites`);
    console.log(`     - ${businesses.filter(b => !b.socialPage).length} with no online presence`);
    console.log(`     - ${businesses.filter(b => b.socialPage).length} with social media only\n`);
    
    return businesses;
  } catch (error) {
    console.error('   ⚠️  Foursquare search failed:', error.response?.data || error.message);
    return [];
  }
}

module.exports = { findBusinessesWithoutWebsite, findBusinessesFromFoursquare };
