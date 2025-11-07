const axios = require('axios');
const Settings = require('../models/Settings');
const logger = require('../src/utils/logger');

/**
 * Skip domains that are social media or aggregators
 */
const SKIP_DOMAINS = [
  'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com', 'youtube.com',
  'zomato.com', 'swiggy.com', 'justdial.com', 'indiamart.com', 'sulekha.com',
  'urbanclap.com', 'google.com', 'yelp.com', 'tripadvisor.com', 'foursquare.com'
];

/**
 * Clean and extract domain from URL
 */
function cleanDomain(url) {
  if (!url) return null;
  try {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
  } catch (error) {
    return null;
  }
}

/**
 * Check if domain should be skipped
 */
function shouldSkipDomain(domain) {
  if (!domain) return true;
  return SKIP_DOMAINS.some(skip => domain.toLowerCase().includes(skip));
}

/**
 * Find emails for a domain using Hunter.io
 */
async function findEmailsByDomain(domain, retries = 2) {
  try {
    const clean = cleanDomain(domain);
    if (!clean || shouldSkipDomain(clean)) {
      return [];
    }

    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.hunter || process.env.HUNTER_API_KEY;
    if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();

    if (!apiKey) {
      return [];
    }

    const response = await axios.get('https://api.hunter.io/v2/domain-search', {
      params: {
        domain: clean,
        api_key: apiKey,
        limit: 5
      },
      timeout: 10000
    });

    const emails = response.data?.data?.emails || [];
    
    // Prefer generic emails (info@, contact@, hello@, support@)
    const genericEmails = emails.filter(e => 
      e.type === 'generic' || 
      e.value.includes('info@') || 
      e.value.includes('contact@') ||
      e.value.includes('hello@') ||
      e.value.includes('support@') ||
      e.value.includes('sales@')
    );

    // Return generic emails first, then personal, limit to 3
    const prioritized = [
      ...genericEmails,
      ...emails.filter(e => e.type === 'personal')
    ];

    return prioritized
      .map(e => e.value)
      .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
      .slice(0, 3);

  } catch (error) {
    if (error.response?.status === 429 && retries > 0) {
      // Rate limit hit, retry after delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      return findEmailsByDomain(domain, retries - 1);
    }
    
    if (retries > 0 && error.code === 'ECONNABORTED') {
      // Timeout, retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return findEmailsByDomain(domain, retries - 1);
    }

    // Log error but don't throw
    if (error.response?.status !== 404) {
      logger.error(`Hunter.io error for ${domain}:`, error.message);
    }
    return [];
  }
}

/**
 * Enrich a single business with emails
 */
async function enrichBusinessWithEmail(business) {
  if (!business.website) {
    return { ...business, email: business.email || null };
  }

  try {
    const emails = await findEmailsByDomain(business.website);
    return {
      ...business,
      email: emails[0] || business.email || null,
      emails: emails.length > 0 ? emails : (business.email ? [business.email] : [])
    };
  } catch (error) {
    return { ...business, email: business.email || null };
  }
}

/**
 * Enrich multiple businesses with emails (batch processing)
 */
async function enrichBusinessesWithEmails(businesses, options = {}) {
  const { 
    batchSize = 5, 
    delayBetweenBatches = 1000,
    skipIfHasEmail = false 
  } = options;

  logger.info(`Enriching ${businesses.length} businesses with Hunter.io emails...`);

  const enriched = [];
  let successCount = 0;

  for (let i = 0; i < businesses.length; i += batchSize) {
    const batch = businesses.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (business) => {
      // Skip if already has email and skipIfHasEmail is true
      if (skipIfHasEmail && business.email) {
        return business;
      }

      return await enrichBusinessWithEmail(business);
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Count successes
    batchResults.forEach(result => {
      if (result.email || (result.emails && result.emails.length > 0)) {
        successCount++;
      }
    });

    enriched.push(...batchResults);

    // Delay between batches to respect rate limits
    if (i + batchSize < businesses.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  logger.success(`Hunter.io: Found emails for ${successCount}/${businesses.length} businesses`);
  return enriched;
}

module.exports = {
  findEmailsByDomain,
  enrichBusinessWithEmail,
  enrichBusinessesWithEmails,
  cleanDomain,
  shouldSkipDomain
};
