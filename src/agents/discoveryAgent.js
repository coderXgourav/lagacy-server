const axios = require('axios');
const logger = require('../utils/logger');
const Settings = require('../../models/Settings');

async function findBusinesses(location, businessCategory = '', radius = 5000) {
  try {
    logger.info('Starting business discovery', { location, businessCategory, radius });
    
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.googlePlaces || process.env.googlePlaces;
    if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();
    const searchQuery = businessCategory ? `${businessCategory} in ${location}` : location;
    
    // Using Google Places Text Search API
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: searchQuery,
        radius: radius,
        key: apiKey
      }
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${response.data.status}`);
    }

    const businesses = [];
    
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

    logger.success(`Found ${businesses.length} businesses with websites`);
    return businesses;
  } catch (error) {
    logger.error('Discovery agent failed', error.message);
    throw error;
  }
}

module.exports = { findBusinesses };
