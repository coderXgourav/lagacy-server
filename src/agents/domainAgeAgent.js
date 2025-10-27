const axios = require('axios');
const logger = require('../utils/logger');
const Settings = require('../../models/Settings');

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

async function checkDomainAge(domain, retries = 2) {
  try {
    const settings = await Settings.findOne();
    let apiKey = settings?.apiKeys?.whoisxml || process.env.whoisxml;
    
    // Remove quotes and trim spaces
    if (apiKey) {
      apiKey = apiKey.replace(/["']/g, '').trim();
    }
    
    if (!apiKey) {
      console.log(`⚠ No WhoisXML API key for ${domain}`);
      return null;
    }
    
    //console.log(`Checking ${domain} with key: ${apiKey.substring(0, 10)}...`);
    const response = await axios.get('https://www.whoisxmlapi.com/whoisserver/WhoisService', {
      params: {
        apiKey,
        domainName: domain,
        outputFormat: 'JSON'
      }
    });

    const whoisRecord = response.data?.WhoisRecord;
    const creationDate = whoisRecord?.createdDate;
    const ownerName = whoisRecord?.registrant?.name || 
                      whoisRecord?.registrant?.organization || 
                      whoisRecord?.administrativeContact?.name ||
                      null;
    
    if (creationDate) {
      console.log(`✓ ${domain} created: ${creationDate}, owner: ${ownerName || 'N/A'}`);
    }
    return { creationDate: creationDate || null, ownerName };
  } catch (error) {
    const status = error.response?.status;
    if (status === 401) {
      console.log(`✗ WhoisXML 401 for ${domain} - Invalid API key`);
      return null;
    }
    if (status === 402) {
      console.log(`✗ WhoisXML 402 for ${domain} - No credits`);
      return null;
    }
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return checkDomainAge(domain, retries - 1);
    }
    console.log(`✗ Failed ${domain}: ${status || error.message}`);
    return null;
  }
}

async function enrichWithDomainAge(businesses) {
  logger.info(`Checking domain age for ${businesses.length} businesses`);
  
  const enriched = [];
  
  for (const business of businesses) {
    const domain = extractDomain(business.website);
    if (!domain) {
      console.log(`⚠ Skipped ${business.website} - Invalid domain`);
      continue;
    }

    const domainInfo = await checkDomainAge(domain);
    
    if (!domainInfo?.creationDate) {
      console.log(`✗ ${domain} - No creation date, skipping`);
      continue;
    }
    
    enriched.push({
      ...business,
      domain,
      creationDate: domainInfo.creationDate,
      ownerName: domainInfo.ownerName
    });
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  logger.success(`Enriched ${enriched.length} businesses with domain age`);
  return enriched;
}

module.exports = { enrichWithDomainAge };
