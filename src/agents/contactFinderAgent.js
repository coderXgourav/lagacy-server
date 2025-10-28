const axios = require('axios');
const logger = require('../utils/logger');
const Settings = require('../../models/Settings');

async function findEmails(domain, retries = 2) {
  try {
    // Skip social media and aggregator domains
    const skipDomains = [
      'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com', 'youtube.com',
      'zomato.com', 'swiggy.com', 'justdial.com', 'indiamart.com', 'sulekha.com',
      'urbanclap.com', 'google.com', 'yelp.com', 'tripadvisor.com'
    ];
    
    if (skipDomains.some(skip => domain.includes(skip))) {
      return [];
    }
    
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.hunter || process.env.hunter;
    if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();
    
    if (!apiKey) {
      return [];
    }
    const response = await axios.get('https://api.hunter.io/v2/domain-search', {
      params: {
        domain,
        api_key: apiKey
      }
    });

    const emails = response.data?.data?.emails || [];
    return emails
      .filter(e => e.type === 'generic' || e.type === 'personal')
      .map(e => e.value)
      .slice(0, 3); // Limit to 3 emails
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return findEmails(domain, retries - 1);
    }
    logger.error(`Failed to find emails for ${domain}`, error.message);
    return [];
  }
}

async function enrichWithEmails(businesses) {
  logger.info(`Email finding disabled - skipping ${businesses.length} businesses`);
  
  // Return businesses without emails (Hunter API paused)
  const enriched = businesses.map(b => ({
    ...b,
    emails: []
  }));

  logger.success(`Skipped email finding for ${businesses.length} businesses`);
  return enriched;
}

module.exports = { enrichWithEmails };
