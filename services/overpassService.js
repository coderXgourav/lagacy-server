const axios = require('axios');

exports.findNewBusinesses = async ({ city, state, country, radius, niche, dateThreshold, limit }) => {
  try {
    const location = await geocodeLocation(city, state, country);
    console.log(`📍 Location: ${location.lat}, ${location.lng}`);
    
    const query = buildOverpassQuery({ lat: location.lat, lng: location.lng, radius, niche, dateThreshold });
    console.log(`🔍 Overpass Query:\n${query}`);
    
    const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 30000
    });

    console.log(`✅ Overpass returned ${response.data.elements?.length || 0} elements`);
    const businesses = parseOverpassResponse(response.data, limit, dateThreshold);
    console.log(`📊 Parsed ${businesses.length} businesses within date range`);
    
    return businesses;
  } catch (error) {
    console.error('Overpass API error:', error.response?.data || error.message);
    return [];
  }
};

async function geocodeLocation(city, state, country) {
  const query = country;
  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: query, format: 'json', limit: 1 },
    headers: { 'User-Agent': 'NewBusinessFinder/1.0' }
  });

  if (response.data.length > 0) {
    return { lat: parseFloat(response.data[0].lat), lng: parseFloat(response.data[0].lon) };
  }
  throw new Error('Location not found');
}

function buildOverpassQuery({ lat, lng, radius, niche, dateThreshold }) {
  const nicheMap = {
    'restaurants': 'restaurant',
    'restaurant': 'restaurant',
    'cafes': 'cafe',
    'cafe': 'cafe'
  };
  
  const mappedNiche = niche ? (nicheMap[niche.toLowerCase()] || niche) : null;
  console.log(`🎯 Niche: "${niche}" -> "${mappedNiche}"`);
  const nicheFilter = mappedNiche ? `["amenity"="${mappedNiche}"]` : '["amenity"]';
  
  return `[out:json][timeout:25];
(
  node${nicheFilter}["name"](around:${radius},${lat},${lng});
  way${nicheFilter}["name"](around:${radius},${lat},${lng});
);
out body;
>;
out skel qt;`;
}

function parseOverpassResponse(data, limit, dateThreshold) {
  const businesses = [];
  if (!data.elements) return businesses;

  // Log all timestamps before filtering
  console.log(`\n📅 All business timestamps:`);
  data.elements.forEach((element, index) => {
    const tags = element.tags || {};
    if (tags.name) {
      console.log(`  ${index + 1}. ${tags.name}: ${element.timestamp || 'NO TIMESTAMP'}`);
    }
  });

  // Filter elements with timestamps and names
  const validElements = data.elements.filter(element => {
    const tags = element.tags || {};
    return element.timestamp && tags.name;
  });

  console.log(`\n🔍 Found ${validElements.length} businesses with timestamps out of ${data.elements.length} total`);

  // Sort by timestamp (most recent first)
  validElements.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  // Filter by date threshold
  const recentElements = validElements.filter(element => {
    const elementDate = new Date(element.timestamp);
    return elementDate >= dateThreshold;
  });

  console.log(`✅ Found ${recentElements.length} businesses within date range (last ${Math.floor((Date.now() - dateThreshold.getTime()) / (1000 * 60 * 60 * 24))} days)`);
  
  if (recentElements.length > 0) {
    console.log(`\n📊 Recent businesses:`);
    recentElements.forEach((element, index) => {
      const tags = element.tags || {};
      console.log(`  ${index + 1}. ${tags.name}: ${element.timestamp}`);
    });
  }

  for (const element of recentElements) {
    if (businesses.length >= limit) break;
    const tags = element.tags || {};

    businesses.push({
      osmId: element.id,
      name: tags.name,
      phone: tags.phone || tags['contact:phone'],
      website: tags.website || tags['contact:website'],
      address: buildAddress(tags),
      city: tags['addr:city'],
      state: tags['addr:state'],
      country: tags['addr:country'],
      niche: tags.amenity || tags.shop || tags.cuisine,
      location: { lat: element.lat || element.center?.lat, lng: element.lon || element.center?.lon },
      timestamp: element.timestamp
    });
  }

  return businesses;
}

function buildAddress(tags) {
  return [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:postcode']]
    .filter(Boolean).join(', ');
}
