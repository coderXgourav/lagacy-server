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

function generateGridPoints(centerLat, centerLng, radius) {
  let numGrids;
  if (radius <= 1000) numGrids = 16;
  else if (radius <= 5000) numGrids = 20;
  else if (radius <= 10000) numGrids = 25;
  else numGrids = 50;
  
  const searchRadius = radius / 2;
  const points = [{ lat: centerLat, lng: centerLng, radius: searchRadius }];
  
  const remaining = numGrids - 1;
  const rings = 3;
  const pointsPerRing = Math.ceil(remaining / rings);
  
  for (let ring = 1; ring <= rings && points.length < numGrids; ring++) {
    const ringRadius = (radius * ring) / (rings + 1);
    const pointsInThisRing = Math.min(pointsPerRing, numGrids - points.length);
    
    for (let i = 0; i < pointsInThisRing; i++) {
      const angle = (i * 360 / pointsInThisRing) * (Math.PI / 180);
      const latOffset = (ringRadius / 111320) * Math.cos(angle);
      const lngOffset = (ringRadius / (111320 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(angle);
      
      points.push({
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset,
        radius: searchRadius
      });
    }
  }
  
  return points.slice(0, numGrids);
}

async function findBusinessesFromGoogle(location, businessCategory, radius, apiKey) {
  try {
    logger.info('Searching Google Places with 25-grid parallel search...');
    
    const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: location, key: apiKey }
    });
    
    if (geocodeResponse.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${geocodeResponse.data.status}`);
    }
    
    const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
    logger.info(`Location coordinates: ${lat}, ${lng}`);
    
    const gridPoints = generateGridPoints(lat, lng, radius);
    logger.info(`⚡ Searching ${gridPoints.length} grids in parallel...`);
    
    // Each grid gets its own seenPlaceIds to avoid race conditions
    const gridSearchPromises = gridPoints.map(point => {
      const gridSeenPlaceIds = new Set();
      return searchGoogleGrid(point.lat, point.lng, businessCategory, point.radius, apiKey, gridSeenPlaceIds);
    });
    
    const gridResults = await Promise.all(gridSearchPromises);
    const allBusinesses = gridResults.flat();
    
    // Deduplicate by place_id first (more accurate than website)
    const seenPlaceIds = new Set();
    const uniqueByPlaceId = [];
    
    for (const business of allBusinesses) {
      // Use website as unique identifier since we don't store place_id
      const normalized = business.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      if (!seenPlaceIds.has(normalized)) {
        seenPlaceIds.add(normalized);
        uniqueByPlaceId.push(business);
      }
    }

    logger.success(`Google Places: Found ${uniqueByPlaceId.length} unique businesses from ${allBusinesses.length} total`);
    return uniqueByPlaceId;
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
    logger.error('Discovery agent failed', error.stack || error.message);
    console.error('Full error:', error);
    throw error;
  }
}

module.exports = { findBusinesses };
