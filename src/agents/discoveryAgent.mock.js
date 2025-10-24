const logger = require('../utils/logger');

// Mock data for testing without Google Places API
async function findBusinesses(location, businessCategory = '', radius = 5000) {
  logger.info('Using MOCK data for testing', { location, businessCategory, radius });
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate more mock businesses based on radius
  const businessCount = Math.min(Math.floor(radius / 500), 20); // More radius = more businesses
  const mockBusinesses = [];
  
  for (let i = 1; i <= businessCount; i++) {
    mockBusinesses.push({
      name: `${businessCategory || 'Business'} ${i}`,
      address: `${i * 10} Street, ${location}`,
      phone: `+91 ${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
      website: `https://business${i}.com`,
      category: businessCategory || 'general'
    });
  }

  logger.success(`Found ${mockBusinesses.length} businesses (MOCK DATA)`);
  return mockBusinesses;
}

module.exports = { findBusinesses };
