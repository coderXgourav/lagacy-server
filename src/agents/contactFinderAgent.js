const axios = require('axios');
const logger = require('../utils/logger');
const Settings = require('../../models/Settings');

async function findEmails(domain, retries = 2) {
  try {
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
  logger.info(`Finding emails for ${businesses.length} businesses`);
  
  const enriched = [];
  
  for (const business of businesses) {
    const emails = await findEmails(business.domain);
    
    enriched.push({
      ...business,
      emails
    });
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.success(`Found emails for ${enriched.filter(b => b.emails.length > 0).length} businesses`);
  return enriched;
}

module.exports = { enrichWithEmails };
