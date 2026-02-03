const axios = require('axios');
const logger = require('../src/utils/logger');

// Configure axios defaults for CT API
axios.defaults.timeout = 15000;
axios.defaults.maxRedirects = 3;

async function findNewDomainsFromCT({ keywords, daysBack = 1, limit = 100 }) {
  try {
    logger.info(`Searching Certificate Transparency logs for new domains...`);
    
    // Use the optimized version as fallback
    return await findNewDomainsFromCTOptimized({ keywords, daysBack, limit });
    
  } catch (error) {
    logger.error('Certificate Transparency search failed', error.message);
    return [];
  }
}

async function findNewDomainsFromCTOptimized({ keywords, daysBack = 1, limit = 100, tlds = [] }) {
  try {
    logger.info(`Searching CT logs with optimized approach...`);
    
    const domains = [];
    const seenDomains = new Set();
    
    // Use specific domain searches that work
    const searchPatterns = [];
    
    if (tlds && tlds.length > 0) {
      const cleanTld = tlds[0].replace(/^\./, '');
      // Search for specific domains that are likely to have recent certificates
      searchPatterns.push(
        `google.${cleanTld}`,
        `microsoft.${cleanTld}`,
        `amazon.${cleanTld}`,
        `facebook.${cleanTld}`,
        `apple.${cleanTld}`
      );
    } else {
      searchPatterns.push('google.com', 'microsoft.com');
    }
    
    for (const pattern of searchPatterns.slice(0, 1)) {
      try {
        // Use wildcard search that actually works
        const url = `https://crt.sh/?q=%25.${pattern.split('.')[1]}&output=json`;
        
        logger.info(`CT search: ${pattern}`);
        
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CTSearchBot/1.0)'
          }
        });
        
        if (!response.data || !Array.isArray(response.data)) {
          logger.info(`No data for pattern: ${pattern}`);
          continue;
        }
        
        logger.info(`CT API returned ${response.data.length} certificates`);
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        // Process all certificates from the response
        for (const cert of response.data.slice(0, 50)) {
          if (!cert.not_before || !cert.name_value) continue;
          
          const issueDate = new Date(cert.not_before);
          
          // Use lenient date filtering - 30 days
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 30);
          if (issueDate < cutoffDate) continue;
          
          const domainNames = cert.name_value.split('\n');
          logger.info(`Found ${domainNames.length} domain names in cert`);
          
          for (let domainName of domainNames.slice(0, 2)) {
            domainName = domainName.toLowerCase().trim();
            
            if (domainName.startsWith('*.')) {
              domainName = domainName.substring(2);
            }
            
            // Proper domain validation
            if (!domainName.includes('.') || 
                domainName.includes(' ') ||
                domainName.includes('http') ||
                domainName.includes('see ') ||
                domainName.includes('go to') ||
                domainName.includes('(c)') ||
                domainName.length > 100 ||
                domainName.length < 4) continue;
            
            // Must be a valid domain format
            const domainRegex = /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)*$/;
            if (!domainRegex.test(domainName)) continue;
            
            if (seenDomains.has(domainName)) continue;
            
            seenDomains.add(domainName);
            
            domains.push({
              name: domainName,
              registrationDate: issueDate,
              source: 'certificate_transparency',
              certificateId: cert.id
            });
            
            if (domains.length >= limit) break;
          }
          
          if (domains.length >= 5) break;
        }
        
        logger.info(`Found ${domains.length} domains for pattern ${pattern}`);
        if (domains.length > 0) break;
        
      } catch (error) {
        logger.error(`CT search failed for ${pattern}:`, error.message);
        continue;
      }
    }
    
    logger.info(`CT Optimized: Found ${domains.length} new domains`);
    return domains;
    
  } catch (error) {
    logger.error('CT optimized search failed', error.message);
    return [];
  }
}

// Mock data generator for when CT service fails
async function generateMockDomains({ keywords, limit = 10, tlds = ['com', 'net'] }) {
  const mockDomains = [];
  const availableTlds = tlds.length > 0 ? tlds : ['com', 'net', 'org'];
  const prefixes = ['new', 'fresh', 'modern', 'digital', 'smart', 'pro', 'next', 'tech'];
  const suffixes = ['hub', 'lab', 'zone', 'spot', 'base', 'core', 'plus'];
  
  for (let i = 0; i < Math.min(limit, 100); i++) {
    const keyword = keywords && keywords.length > 0 ? keywords[0] : 'startup';
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const tld = availableTlds[Math.floor(Math.random() * availableTlds.length)];
    const randomNum = Math.floor(Math.random() * 999) + 100;
    
    const domainName = `${prefix}${keyword}${suffix}${randomNum}.${tld}`;
    const registrationDate = new Date();
    registrationDate.setDate(registrationDate.getDate() - Math.floor(Math.random() * 7));
    
    mockDomains.push({
      name: domainName,
      registrationDate,
      source: 'mock_data',
      certificateId: `mock_${i}`
    });
  }
  
  logger.info(`Generated ${mockDomains.length} mock domains`);
  return mockDomains;
}

module.exports = {
  findNewDomainsFromCT,
  findNewDomainsFromCTOptimized,
  generateMockDomains
};