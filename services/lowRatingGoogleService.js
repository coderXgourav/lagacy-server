const axios = require('axios');
const Settings = require('../models/Settings');

function generateGridPoints(centerLat, centerLng, radius) {
  const blockSize = 400; // 400m = 2-3 blocks (balanced)
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
      
      // Collect ALL businesses (rating will be fetched from Details API)
      businesses.push({
        place_id: place.place_id,
        name: place.name,
        rating: place.rating || null,
        totalReviews: place.user_ratings_total || 0,
        address: place.vicinity,
        location: place.geometry?.location
      });
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
    console.log(`\n⚡ Searching ${gridPoints.length} grids in batches of 16...`);
    
    const batchSize = 16;
    const gridResults = [];
    
    for (let i = 0; i < gridPoints.length; i += batchSize) {
      const batch = gridPoints.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(gridPoints.length / batchSize);
      
      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} grids)...`);
      
      const batchPromises = batch.map(grid => searchGrid(grid, category, apiKey));
      const batchResults = await Promise.all(batchPromises);
      gridResults.push(...batchResults);
      
      // Cooldown between batches
      if (i + batchSize < gridPoints.length) {
        console.log(`⏳ Cooling down 2s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const allBusinesses = gridResults.flat();
    const uniqueBusinesses = new Map();
    
    // Deduplicate by place_id
    for (const business of allBusinesses) {
      if (!uniqueBusinesses.has(business.place_id)) {
        uniqueBusinesses.set(business.place_id, business);
      }
    }
    
    console.log(`\n✅ Found ${allBusinesses.length} total, ${uniqueBusinesses.size} unique businesses`);
    console.log(`🔍 Fetching ratings from Details API...`);
    
    const detailedBusinesses = [];
    let processed = 0;
    
    for (const [placeId, business] of uniqueBusinesses) {
      if (detailedBusinesses.length >= limit) break;
      
      try {
        const details = await getPlaceDetails(placeId, apiKey);
        
        // Filter by rating AFTER fetching details
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
        if (processed % 20 === 0) {
          console.log(`📊 Processed ${processed}/${uniqueBusinesses.size} (Found ${detailedBusinesses.length} with rating ≤ ${maxRating})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
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
