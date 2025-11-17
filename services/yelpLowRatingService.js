const axios = require('axios');
const logger = require('../src/utils/logger');
const Settings = require('../models/Settings');

async function findLowRatedBusinesses({ lat, lng, city, state, country, radius, category, maxRating, limit }) {
  try {
    logger.info('Searching Yelp for low-rated businesses...');
    
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.yelp || process.env.YELP_API_KEY;
    if (apiKey) apiKey = apiKey.replace(/[\"']/g, '').trim();
    
    if (!apiKey) {
      logger.info('No Yelp API key, skipping low-rating search');
      return [];
    }

    // Use coordinates if provided, otherwise use location string
    let searchParams;
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      searchParams = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radius: Math.min(radius || 5000, 40000),
        limit: Math.min(limit || 50, 50),
        sort_by: 'rating'
      };
      logger.info(`Searching Yelp at coordinates: ${lat}, ${lng}`);
    } else {
      const location = `${city}${state ? ', ' + state : ''}, ${country}`;
      searchParams = {
        location: location,
        radius: Math.min(radius || 5000, 40000),
        limit: Math.min(limit || 50, 50),
        sort_by: 'rating'
      };
      logger.info(`Searching Yelp at location: ${location}`);
    }
    
    const businesses = [];
    
    if (category) searchParams.term = category;

    const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
      params: searchParams,
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