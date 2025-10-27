const axios = require('axios');
const logger = require('../utils/logger');
const Settings = require('../../models/Settings');

async function findBusinesses(location, businessCategory = '', radius = 5000) {
  try {
    logger.info('Starting business discovery', { location, businessCategory, radius });
    
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.googlePlaces || process.env.googlePlaces;
    if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();
    
    // Get coordinates for the location
    const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: location, key: apiKey }
    });
    
    if (geocodeResponse.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${geocodeResponse.data.status}`);
    }
    
    const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
    logger.info(`Location coordinates: ${lat}, ${lng}`);
    
    const businesses = [];
    let nextPageToken = null;
    let pageCount = 0;
    const maxPages = 10; // Increased to get more results
    
    do {
      const params = { location: `${lat},${lng}`, radius: radius, key: apiKey };
      if (businessCategory) params.keyword = businessCategory;
      if (nextPageToken) {
        params.pagetoken = nextPageToken;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', { params });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }
    
      for (const place of response.data.results || []) {
        // Get place details for website and phone
        const detailsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
          params: {
            place_id: place.place_id,
            fields: 'name,formatted_address,formatted_phone_number,website,types',
            key: apiKey
          }
        });

        const details = detailsResponse.data.result;
        
        if (details.website) {
          console.log(`✓ Found: ${details.name} - ${details.website}`);
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

    logger.success(`Found ${businesses.length} businesses with websites`);
    return businesses;
  } catch (error) {
    logger.error('Discovery agent failed', error.message);
    throw error;
  }
}

module.exports = { findBusinesses };
