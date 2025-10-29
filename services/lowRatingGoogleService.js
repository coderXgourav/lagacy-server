const axios = require('axios');
const Settings = require('../models/Settings');

function generateGridPoints(centerLat, centerLng, radius) {
  const earthRadius = 6371000;
  const gridRadius = radius * 0.45;
  
  const points = [{ lat: centerLat, lng: centerLng }];
  
  // Inner ring: 9 points at 40% offset
  const innerOffset = radius * 0.4;
  for (let i = 0; i < 8; i++) {
    const angle = (i * 45) * (Math.PI / 180);
    const latOffset = (innerOffset / earthRadius) * (180 / Math.PI);
    const lngOffset = (innerOffset / (earthRadius * Math.cos(centerLat * Math.PI / 180))) * (180 / Math.PI);
    points.push({
      lat: centerLat + latOffset * Math.cos(angle),
      lng: centerLng + lngOffset * Math.sin(angle)
    });
  }
  
  // Outer ring: 7 points at 70% offset
  const outerOffset = radius * 0.7;
  const outerAngles = [0, 51.43, 102.86, 154.29, 205.71, 257.14, 308.57];
  for (const angleDeg of outerAngles) {
    const angle = angleDeg * (Math.PI / 180);
    const latOffset = (outerOffset / earthRadius) * (180 / Math.PI);
    const lngOffset = (outerOffset / (earthRadius * Math.cos(centerLat * Math.PI / 180))) * (180 / Math.PI);
    points.push({
      lat: centerLat + latOffset * Math.cos(angle),
      lng: centerLng + lngOffset * Math.sin(angle)
    });
  }
  
  return points.map(p => ({ ...p, radius: gridRadius }));
}

async function geocodeLocation(address, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json`;
  const response = await axios.get(url, {
    params: { address, key: apiKey }
  });
  
  const location = response.data.results[0]?.geometry?.location;
  if (!location) throw new Error('Location not found');
  
  return location;
}

async function searchGrid(gridPoint, category, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
  const businesses = [];
  const seenPlaceIds = new Set();
  
  try {
    const params = {
      location: `${gridPoint.lat},${gridPoint.lng}`,
      radius: gridPoint.radius,
      key: apiKey
    };
    
    if (category) params.keyword = category;
    
    const response = await axios.get(url, { params });
    
    for (const place of response.data.results || []) {
      if (seenPlaceIds.has(place.place_id)) continue;
      seenPlaceIds.add(place.place_id);
      
      // Collect ALL businesses with ratings (filter later)
      if (place.rating) {
        businesses.push({
          place_id: place.place_id,
          name: place.name,
          rating: place.rating,
          totalReviews: place.user_ratings_total || 0,
          address: place.vicinity,
          location: place.geometry?.location
        });
      }
    }
  } catch (error) {
    console.error(`Grid search error:`, error.message);
  }
  
  return businesses;
}

async function getPlaceDetails(placeId, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json`;
  const response = await axios.get(url, {
    params: {
      place_id: placeId,
      fields: 'name,rating,user_ratings_total,formatted_phone_number,formatted_address,website,types,geometry',
      key: apiKey
    }
  });
  
  return response.data.result;
}

exports.findBusinessesByRating = async ({ city, state, country, radius, category, maxRating, limit }) => {
  try {
    const settings = await Settings.findOne();
    const apiKey = settings?.apiKeys?.googlePlaces || process.env.GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) throw new Error('Google Places API key not configured');

    const locationStr = state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
    const centerLocation = await geocodeLocation(locationStr, apiKey);
    
    console.log(`\n🎯 Starting 16-grid parallel search for low-rating businesses in ${city}`);
    console.log(`📍 Center: ${centerLocation.lat}, ${centerLocation.lng}`);
    console.log(`📏 Radius: ${radius}m, Max Rating: ${maxRating}`);
    
    const gridPoints = generateGridPoints(centerLocation.lat, centerLocation.lng, radius);
    console.log(`\n⚡ Searching ${gridPoints.length} grids in parallel...`);
    
    const gridSearchPromises = gridPoints.map(grid => searchGrid(grid, category, apiKey));
    const gridResults = await Promise.all(gridSearchPromises);
    
    const allBusinesses = gridResults.flat();
    const uniqueBusinesses = new Map();
    
    // Deduplicate and filter by rating
    for (const business of allBusinesses) {
      if (!uniqueBusinesses.has(business.place_id) && business.rating <= maxRating) {
        uniqueBusinesses.set(business.place_id, business);
      }
    }
    
    console.log(`\n✅ Found ${allBusinesses.length} total businesses, ${uniqueBusinesses.size} unique with rating ≤ ${maxRating}`);
    console.log(`🔍 Fetching detailed information...`);
    
    const detailedBusinesses = [];
    let processed = 0;
    
    for (const [placeId, business] of uniqueBusinesses) {
      if (detailedBusinesses.length >= limit) break;
      
      try {
        const details = await getPlaceDetails(placeId, apiKey);
        
        if (details.rating && details.rating <= maxRating) {
          detailedBusinesses.push({
            name: details.name,
            rating: details.rating,
            totalReviews: details.user_ratings_total || 0,
            phone: details.formatted_phone_number,
            website: details.website,
            address: details.formatted_address,
            category: details.types?.[0],
            email: null,
            location: {
              lat: details.geometry.location.lat,
              lng: details.geometry.location.lng
            },
            city,
            state,
            country
          });
        }
        
        processed++;
        if (processed % 10 === 0) {
          console.log(`📊 Processed ${processed}/${uniqueBusinesses.size} businesses...`);
        }
      } catch (error) {
        console.error(`Error fetching details for ${business.name}:`, error.message);
      }
    }
    
    console.log(`\n✅ Successfully enriched ${detailedBusinesses.length} businesses\n`);
    return detailedBusinesses;

  } catch (error) {
    console.error('Google Places error:', error);
    throw new Error('Failed to fetch businesses from Google Places');
  }
};
