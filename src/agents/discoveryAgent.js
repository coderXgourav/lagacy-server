const axios = require('axios');
const logger = require('../utils/logger');
const Settings = require('../../models/Settings');

async function searchGoogleGrid(lat, lng, businessCategory, radius, apiKey, seenPlaceIds) {
  const businesses = [];
  let nextPageToken = null;
  let pageCount = 0;
  const maxPages = 3; // Google's hard limit
  
  do {
    const params = { location: `${lat},${lng}`, radius: radius, key: apiKey };
    if (businessCategory) params.keyword = businessCategory;
    if (nextPageToken) {
      params.pagetoken = nextPageToken;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', { params });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      break;
    }
  
    for (const place of response.data.results || []) {
      // Skip if already seen this place_id
      if (seenPlaceIds.has(place.place_id)) {
        continue;
      }
      seenPlaceIds.add(place.place_id);
      
      const detailsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
        params: {
          place_id: place.place_id,
          fields: 'name,formatted_address,formatted_phone_number,website,types',
          key: apiKey
        }
      });

      const details = detailsResponse.data.result;
      
      if (details.website) {
        businesses.push({
          name: details.name,
          address: details.formatted_address,
          phone: details.formatted_phone_number || '',
          website: details.website,
          category: details.types?.[0] || businessCategory || 'general'
        });
      }
    }
    
    nextPageToken = response.data.next_page_token;
    pageCount++;
    
  } while (nextPageToken && pageCount < maxPages);
  
  return businesses;
}

async function findBusinessesFromGoogle(location, businessCategory, radius, apiKey) {
  try {
    logger.info('Searching Google Places with grid search...');
    
    const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: location, key: apiKey }
    });
    
    if (geocodeResponse.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${geocodeResponse.data.status}`);
    }
    
    const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
    logger.info(`Location coordinates: ${lat}, ${lng}`);
    
    // Create 16 grid points for maximum coverage
    // Two rings: inner (40% offset) and outer (70% offset)
    const innerOffset = (radius * 0.4) / 111320;
    const outerOffset = (radius * 0.7) / 111320;
    const gridRadius = Math.floor(radius * 0.45); // Each grid searches 45% radius
    
    const gridPoints = [
      // Inner ring (8 points)
      { lat, lng, name: 'Center', radius: gridRadius },
      { lat: lat + innerOffset, lng, name: 'N', radius: gridRadius },
      { lat: lat - innerOffset, lng, name: 'S', radius: gridRadius },
      { lat, lng: lng + innerOffset, name: 'E', radius: gridRadius },
      { lat, lng: lng - innerOffset, name: 'W', radius: gridRadius },
      { lat: lat + innerOffset, lng: lng + innerOffset, name: 'NE', radius: gridRadius },
      { lat: lat + innerOffset, lng: lng - innerOffset, name: 'NW', radius: gridRadius },
      { lat: lat - innerOffset, lng: lng + innerOffset, name: 'SE', radius: gridRadius },
      { lat: lat - innerOffset, lng: lng - innerOffset, name: 'SW', radius: gridRadius },
      // Outer ring (7 points)
      { lat: lat + outerOffset, lng, name: 'N2', radius: gridRadius },
      { lat: lat - outerOffset, lng, name: 'S2', radius: gridRadius },
      { lat, lng: lng + outerOffset, name: 'E2', radius: gridRadius },
      { lat, lng: lng - outerOffset, name: 'W2', radius: gridRadius },
      { lat: lat + outerOffset, lng: lng + outerOffset, name: 'NE2', radius: gridRadius },
      { lat: lat + outerOffset, lng: lng - outerOffset, name: 'NW2', radius: gridRadius },
      { lat: lat - outerOffset, lng: lng + outerOffset, name: 'SE2', radius: gridRadius }
    ];
    
    const allBusinesses = [];
    const seenPlaceIds = new Set(); // Track place_ids across all grids
    
    // Search each grid point with smaller radius
    for (const point of gridPoints) {
      const gridResults = await searchGoogleGrid(point.lat, point.lng, businessCategory, point.radius, apiKey, seenPlaceIds);
      allBusinesses.push(...gridResults);
      logger.info(`Grid ${point.name} (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}): ${gridResults.length} new businesses`);
    }
    
    // Deduplicate by website
    const uniqueBusinesses = [];
    const seenWebsites = new Set();
    
    for (const business of allBusinesses) {
      const normalized = business.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      if (!seenWebsites.has(normalized)) {
        seenWebsites.add(normalized);
        uniqueBusinesses.push(business);
        console.log(`✓ Found: ${business.name} - ${business.website}`);
      }
    }

    logger.success(`Google Places: Found ${uniqueBusinesses.length} unique businesses from ${allBusinesses.length} total`);
    return uniqueBusinesses;
  } catch (error) {
    logger.error('Google Places failed', error.message);
    return [];
  }
}

async function findBusinessesFromFoursquare(location, businessCategory, radius, lat, lng) {
  try {
    logger.info('Searching Foursquare...');
    
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.foursquare || process.env.FOURSQUARE_API_KEY;
    if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();
    
    if (!apiKey) {
      logger.info('No Foursquare API key, skipping');
      return [];
    }
    
    const businesses = [];
    const limit = 50; // Increased from 50
    
    const params = {
      ll: `${lat},${lng}`,
      radius: radius,
      limit: limit
    };
    if (businessCategory) params.query = businessCategory;
    
    const response = await axios.get('https://places-api.foursquare.com/places/search', {
      params,
      headers: {
        'X-Places-Api-Version': '2025-06-17',
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`
      }
    });
    
    for (const place of response.data.results || []) {
      // Only include businesses with actual websites (not Foursquare URLs)
      if (place.website) {
        console.log(`✓ Foursquare: ${place.name} - ${place.website}`);
        businesses.push({
          name: place.name,
          address: place.location?.formatted_address || `${place.location?.address || ''}, ${place.location?.locality || ''}`,
          phone: place.tel || '',
          website: place.website,
          category: place.categories?.[0]?.name || businessCategory || 'general'
        });
      }
    }
    
    logger.success(`Foursquare: Found ${businesses.length} businesses`);
    return businesses;
  } catch (error) {
    logger.error('Foursquare failed', error.response?.data || error.message);
    return [];
  }
}



async function findBusinesses(location, businessCategory = '', radius = 5000) {
  try {
    logger.info('Starting multi-API business discovery', { location, businessCategory, radius });
    
    const settings = await Settings.findOne();
    let googleApiKey = settings?.apiKeys?.googlePlaces || process.env.googlePlaces;
    if (googleApiKey) googleApiKey = googleApiKey.replace(/["']/g, '').trim();
    
    // Get coordinates first for both APIs
    const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: location, key: googleApiKey }
    });
    
    let lat, lng;
    if (geocodeResponse.data.status === 'OK') {
      ({ lat, lng } = geocodeResponse.data.results[0].geometry.location);
    }
    
    // Search Google and Foursquare (Bing disabled)
    const [googleResults, foursquareResults] = await Promise.all([
      findBusinessesFromGoogle(location, businessCategory, radius, googleApiKey),
      lat && lng ? findBusinessesFromFoursquare(location, businessCategory, radius, lat, lng) : Promise.resolve([])
    ]);
    const bingResults = [];
    
    // Combine and deduplicate by website
    const allBusinesses = [...googleResults, ...foursquareResults];
    const uniqueBusinesses = [];
    const seenWebsites = new Set();
    
    for (const business of allBusinesses) {
      const normalizedWebsite = business.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      if (!seenWebsites.has(normalizedWebsite)) {
        seenWebsites.add(normalizedWebsite);
        uniqueBusinesses.push(business);
      }
    }
    
    logger.success(`Total unique businesses: ${uniqueBusinesses.length} (Google: ${googleResults.length}, Foursquare: ${foursquareResults.length})`);
    return uniqueBusinesses;
  } catch (error) {
    logger.error('Discovery agent failed', error.message);
    throw error;
  }
}

module.exports = { findBusinesses };
