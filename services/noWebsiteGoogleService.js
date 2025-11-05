const axios = require('axios');
const Settings = require('../models/Settings');

function generateGridPoints(centerLat, centerLng, radius) {
  const blockSize = 800;
  const gridRadius = Math.min(blockSize, Math.floor(radius * 0.3));
  const gridCount = Math.ceil(radius / blockSize);
  const points = [];
  
  for (let x = -gridCount; x <= gridCount; x++) {
    for (let y = -gridCount; y <= gridCount; y++) {
      const offsetLat = (x * blockSize) / 111320;
      const offsetLng = (y * blockSize) / (111320 * Math.cos(centerLat * Math.PI / 180));
      const distance = Math.sqrt(x*x + y*y) * blockSize;
      
      if (distance <= radius) {
        points.push({
          lat: centerLat + offsetLat,
          lng: centerLng + offsetLng,
          radius: gridRadius
        });
      }
    }
  }
  
  return points;
}

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
    
    console.log(`🔍 Step 2: Generating dynamic grid points...`);
    const gridPoints = generateGridPoints(lat, lng, radius);
    console.log(`   ✓ Generated ${gridPoints.length} grid points for comprehensive coverage\n`);
    
    const seenPlaceIds = new Set();
    let noWebsiteCount = 0;
    let socialMediaCount = 0;
    
    console.log(`⚡ Step 3: Searching ${gridPoints.length} grids in batches of 16...\n`);
    
    const batchSize = 16;
    const allGridResults = [];
    
    for (let i = 0; i < gridPoints.length; i += batchSize) {
      const batch = gridPoints.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(gridPoints.length / batchSize);
      
      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} grids)...`);
      
      const batchPromises = batch.map(point => 
        searchGoogleGridNoWebsite(
          point.lat,
          point.lng,
          category,
          point.radius,
          apiKey,
          seenPlaceIds,
          limit,
          null,
          null
        ).then(results => ({ results }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      allGridResults.push(...batchResults);
      
      if (i + batchSize < gridPoints.length) {
        console.log(`⏳ Cooling down 2s before next batch...\n`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const gridSearchResults = allGridResults;
    
    // Process results from all grids
    const allBusinesses = [];
    
    for (const { results: gridResults } of gridSearchResults) {
      allBusinesses.push(...gridResults);
      
      const socialInGrid = gridResults.filter(b => b.socialPage).length;
      const noWebInGrid = gridResults.length - socialInGrid;
      
      noWebsiteCount += noWebInGrid;
      socialMediaCount += socialInGrid;
    }
    
    console.log(`\n✅ Found ${allBusinesses.length} total businesses`);
    console.log(`   - ${noWebsiteCount} with NO website at all`);
    console.log(`   - ${socialMediaCount} with social media only\n`);
    
    console.log(`🛡️  Step 4: Deduplicating by phone number...`);
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
    console.log(`   - Unique businesses: ${uniqueBusinesses.length}`);
    console.log(`   - Returning: ${finalResults.length}`);
    console.log(`   - No website: ${finalResults.filter(b => !b.socialPage).length}`);
    console.log(`   - Social media only: ${finalResults.filter(b => b.socialPage).length}`);
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
