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

async function checkWhoisXML(domain, apiKey) {
  const response = await axios.get('https://www.whoisxmlapi.com/whoisserver/WhoisService', {
    params: { apiKey, domainName: domain, outputFormat: 'JSON' }
  });
  const whoisRecord = response.data?.WhoisRecord;
  return {
    creationDate: whoisRecord?.createdDate || null,
    ownerName: whoisRecord?.registrant?.name || whoisRecord?.registrant?.organization || whoisRecord?.administrativeContact?.name || null
  };
}

async function checkWhoAPI(domain) {
  const response = await axios.get(`https://www.whoisxmlapi.com/whoisserver/DNSService`, {
    params: { apiKey: process.env.WHOIS_API_KEY, domainName: domain, type: '_all', outputFormat: 'JSON' }
  });
  const data = response.data?.DNSData;
  return {
    creationDate: data?.audit?.createdDate || null,
    ownerName: null
  };
}

async function checkRDAPAPI(domain) {
  const response = await axios.get(`https://rdap.org/domain/${domain}`);
  const events = response.data?.events || [];
  const registration = events.find(e => e.eventAction === 'registration');
  
  let ownerName = null;
  const vcardData = response.data?.entities?.[0]?.vcardArray?.[1];
  if (vcardData) {
    const fnField = vcardData.find(field => field[0] === 'fn');
    if (fnField && fnField[3]) {
      ownerName = Array.isArray(fnField[3]) ? fnField[3].filter(v => v).join(' ') : String(fnField[3]);
    }
  }
  
  return {
    creationDate: registration?.eventDate || null,
    ownerName: ownerName || null
  };
}

async function checkWhoisFreaks(domain, apiKey) {
  const response = await axios.get(`https://api.whoisfreaks.com/v1.0/whois`, {
    params: { whois: 'live', domainName: domain, apiKey }
  });
  return {
    creationDate: response.data?.create_date || null,
    ownerName: response.data?.registrant_name || response.data?.registrant_organization || null
  };
}

async function checkDomainAge(domain, retries = 2) {
  try {
    const settings = await Settings.findOne();
    
    // Try RDAP first (100% free, no API key)
    try {
      const result = await checkRDAPAPI(domain);
      if (result.creationDate) {
        console.log(`✓ RDAP: ${domain} created: ${result.creationDate}`);
        return result;
      }
    } catch (error) {
      console.log(`✗ RDAP failed for ${domain}`);
    }
    
    // Try WhoisFreaks (free tier: 1000/month)
    let whoisFreaksKey = settings?.apiKeys?.whoisfreaks || process.env.WHOISFREAKS_API_KEY;
    if (whoisFreaksKey) {
      whoisFreaksKey = whoisFreaksKey.replace(/["']/g, '').trim();
      try {
        const result = await checkWhoisFreaks(domain, whoisFreaksKey);
        if (result.creationDate) {
          console.log(`✓ WhoisFreaks: ${domain} created: ${result.creationDate}`);
          return result;
        }
      } catch (error) {
        console.log(`✗ WhoisFreaks failed for ${domain}`);
      }
    }
    
    
    // Fallback to WhoisXML only if all free APIs fail (conserve credits)
    let apiKey = settings?.apiKeys?.whoisxml || process.env.whoisxml;
    if (apiKey) apiKey = apiKey.replace(/["']/g, '').trim();
    
    if (apiKey) {
      try {
        const result = await checkWhoisXML(domain, apiKey);
        if (result.creationDate) {
          console.log(`✓ WhoisXML: ${domain} created: ${result.creationDate}`);
          return result;
        }
      } catch (error) {
        console.log(`✗ WhoisXML failed for ${domain}: ${error.response?.status || error.message}`);
      }
    }
    
    console.log(`✗ All WHOIS APIs failed for ${domain}`);
    return null;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return checkDomainAge(domain, retries - 1);
    }
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
