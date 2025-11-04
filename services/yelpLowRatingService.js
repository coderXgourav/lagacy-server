const axios = require('axios');
const logger = require('../src/utils/logger');
const Settings = require('../models/Settings');

async function findLowRatedBusinesses({ city, state, country, radius, category, maxRating, limit }) {
  try {
    logger.info('Searching Yelp for low-rated businesses...');
    
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.yelp || process.env.YELP_API_KEY;
    if (apiKey) apiKey = apiKey.replace(/[\"']/g, '').trim();
    
    if (!apiKey) {
      logger.info('No Yelp API key, skipping low-rating search');
      return [];
    }

    // Geocode location first
    const location = `${city}${state ? ', ' + state : ''}, ${country}`;
    
    const businesses = [];
    const searchLimit = Math.min(limit || 50, 50); // Yelp max is 50 per request
    
    const params = {
      location: location,
      radius: Math.min(radius || 5000, 40000), // Yelp max is 40km
      limit: searchLimit,
      sort_by: 'rating' // Sort by rating to get lower rated first
    };
    
    if (category) params.term = category;

    const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
      params,
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    for (const business of response.data.businesses || []) {
      // Filter by rating threshold
      if (business.rating <= maxRating) {
        businesses.push({
          name: business.name,
          rating: business.rating,
          totalReviews: business.review_count,
          phone: business.display_phone || business.phone || '',
          website: '', // Yelp doesn't provide external websites
          yelpUrl: business.url,
          address: business.location?.display_address?.join(', ') || '',
          city: business.location?.city || city,
          state: business.location?.state || state,
          country: country,
          category: business.categories?.[0]?.title || category || 'general',
          location: {
            lat: business.coordinates?.latitude,
            lng: business.coordinates?.longitude
          },
          source: 'yelp'
        });
      }
    }

    logger.success(`Yelp: Found ${businesses.length} businesses with rating ≤ ${maxRating}`);
    return businesses;
    
  } catch (error) {
    logger.error('Yelp low-rating search failed', error.response?.data || error.message);
    return [];
  }
}

module.exports = { findLowRatedBusinesses };