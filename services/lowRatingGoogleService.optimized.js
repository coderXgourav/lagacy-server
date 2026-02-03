const axios = require('axios');
const Settings = require('../models/Settings');

function generateGridPoints(centerLat, centerLng, radius) {
  const blockSize = 800; // Keep 800m blocks
  const gridRadius = 600; // Fixed 600m search radius (no overlap)
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

async function searchGrid(gridPoint, category, apiKey, globalSeenIds) {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
  const businesses = [];
  
  try {
    const params = {
      location: `${gridPoint.lat},${gridPoint.lng}`,
      radius: gridPoint.radius,
      key: apiKey
    };
    
    if (category) params.keyword = category;
    
    const response = await axios.get(url, { params });
    
    for (const place of response.data.results || []) {
      if (globalSeenIds.has(place.place_id)) continue;
      globalSeenIds.add(place.place_id);
      
      businesses.push({
        place_id: place.place_id,
        name: place.name,
        rating: place.rating || null,
        totalReviews: place.user_ratings_total || 0,
        address: place.vicinity,
        location: place.geometry?.location,
        hasRating: !!place.rating
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

async function searchFoursquare(lat, lng, radius, category, maxRating, limit) {
  try {
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.foursquare || process.env.FOURSQUARE_API_KEY;
    if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();
    
    if (!apiKey) return [];

    const response = await axios.get('https://places-api.foursquare.com/places/search', {
      params: {
        ll: `${lat},${lng}`,
        radius: radius,
        limit: 50,
        query: category,
        fields: 'name,rating,stats,tel,website,location,categories,geocodes'
      },
      headers: {
        'X-Places-Api-Version': '2025-06-17',
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`
      }
    });

    console.log(`📊 Foursquare returned ${response.data.results?.length || 0} places`);
    
    const businesses = [];
    for (const place of response.data.results || []) {
      console.log(`  - ${place.name}: rating=${place.rating || 'NO RATING'}, stats=${JSON.stringify(place.stats)}`);
      
      if (place.rating && place.rating <= maxRating) {
        businesses.push({
          name: place.name,
          rating: place.rating,
          totalReviews: place.stats?.total_ratings || 0,
          phone: place.tel,
          website: place.website,
          address: place.location?.formatted_address,
          category: place.categories?.[0]?.name,
          location: { lat: place.geocodes?.main?.latitude, lng: place.geocodes?.main?.longitude }
        });
      }
    }
    
    console.log(`🟦 Foursquare: Found ${businesses.length} businesses with rating ≤ ${maxRating}`);
    return businesses;
  } catch (error) {
    console.error('Foursquare error:', error.message);
    return [];
  }
}

exports.findBusinessesByRating = async ({ lat, lng, city, state, country, radius, category, maxRating, limit }) => {
  try {
    const settings = await Settings.findOne();
    const apiKey = settings?.apiKeys?.googlePlaces || process.env.GOOGLE_PLACES_API_KEY;
    
    // Use provided coordinates or geocode location
    let centerLocation;
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      centerLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
      console.log(`📍 Using provided coordinates: ${centerLocation.lat}, ${centerLocation.lng}`);
    } else {
      const locationStr = state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
      centerLocation = await geocodeLocation(locationStr, apiKey);
      console.log(`🔍 Geocoded location: ${centerLocation.lat}, ${centerLocation.lng}`);
    }
    
    console.log(`\n🎯 Searching for low-rating businesses in ${city}`);
    console.log(`📍 Center: ${centerLocation.lat}, ${centerLocation.lng}`);
    console.log(`📏 Radius: ${radius}m, Max Rating: ${maxRating}`);
    
    const gridPoints = generateGridPoints(centerLocation.lat, centerLocation.lng, radius);
    console.log(`🔍 Searching ${gridPoints.length} grid points...`);
    
    const globalSeenIds = new Set();
    const allBusinesses = [];
    const batchSize = 8;
    
    for (let i = 0; i < gridPoints.length; i += batchSize) {
      const batch = gridPoints.slice(i, i + batchSize);
      console.log(`⚡ Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gridPoints.length / batchSize)} (${batch.length} grids)...`);
      const batchPromises = batch.map(point => searchGrid(point, category, apiKey, globalSeenIds));
      const batchResults = await Promise.all(batchPromises);
      allBusinesses.push(...batchResults.flat());
    }
    
    console.log(`📊 Found ${allBusinesses.length} unique businesses`);
    
    // Filter businesses that meet the rating criteria first
    const lowRatedBusinesses = allBusinesses.filter(b => b.hasRating && b.rating <= maxRating);
    const needsDetails = allBusinesses.filter(b => !b.hasRating);
    
    console.log(`✅ ${lowRatedBusinesses.length} already have low ratings`);
    console.log(`🔎 ${needsDetails.length} need Details API calls`);
    
    // Get details for all low-rated businesses to fetch phone numbers
    const detailedLowRated = [];
    for (let i = 0; i < Math.min(lowRatedBusinesses.length, limit); i++) {
      const business = lowRatedBusinesses[i];
      try {
        const details = await getPlaceDetails(business.place_id, apiKey);
        detailedLowRated.push({
          name: details.name,
          rating: details.rating,
          totalReviews: details.user_ratings_total || 0,
          phone: details.formatted_phone_number,
          address: details.formatted_address,
          website: details.website,
          category: details.types?.[0] || category,
          location: details.geometry?.location
        });
      } catch (error) {
        console.error(`Failed to get details for ${business.name}:`, error.message);
      }
    }
    
    // Also check businesses without ratings
    const detailsLimit = Math.min(needsDetails.length, limit * 2);
    const additionalBusinesses = [];
    
    for (let i = 0; i < detailsLimit && detailedLowRated.length + additionalBusinesses.length < limit; i++) {
      const business = needsDetails[i];
      try {
        const details = await getPlaceDetails(business.place_id, apiKey);
        
        if (details.rating && details.rating <= maxRating) {
          additionalBusinesses.push({
            name: details.name,
            rating: details.rating,
            totalReviews: details.user_ratings_total || 0,
            phone: details.formatted_phone_number,
            address: details.formatted_address,
            website: details.website,
            category: details.types?.[0] || category,
            location: details.geometry?.location
          });
        }
      } catch (error) {
        console.error(`Failed to get details for ${business.name}:`, error.message);
      }
    }
    
    const finalResults = [...detailedLowRated, ...additionalBusinesses].slice(0, limit);
    
    console.log(`\n✅ Found ${finalResults.length} businesses with ratings ≤ ${maxRating}\n`);
    
    return finalResults;

  } catch (error) {
    console.error('Search error:', error);
    throw new Error('Failed to fetch businesses');
  }
};
