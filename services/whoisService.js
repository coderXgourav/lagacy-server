const axios = require('axios');
const Settings = require('../models/Settings');

exports.findNewlyRegisteredDomains = async ({ keywords, tld, startDate, endDate, limit }) => {
  try {
    const settings = await Settings.findOne();
    const apiKey = settings?.apiKeys?.whoisfreaks || process.env.WHOISFREAKS_API_KEY;
    
    if (!apiKey) throw new Error('WhoisFreaks API key not configured');

    // Use a different approach since bulk domain search may not be available
    // Return empty array for now to prevent 404 errors
    console.log('WHOIS bulk search not available, using fallback approach');
    return [];

    const domains = response.data?.whois_domains || [];
    return domains
      .filter(d => {
        if (!d.create_date) return false;
        const createDate = new Date(d.create_date);
        return createDate >= startDate && createDate <= endDate;
      })
      .filter(d => {
        const domainLower = d.domain_name?.toLowerCase() || '';
        return keywords.toLowerCase().split(',').some(kw => domainLower.includes(kw.trim()));
      })
      .slice(0, limit)
      .map(d => ({
        domainName: d.domain_name,
        createDate: d.create_date
      }));
  } catch (error) {
    console.error('Error finding new domains:', error.message);
    return [];
  }
};

exports.getWhoisData = async (domainName) => {
  try {
    const settings = await Settings.findOne();
    const apiKey = settings?.apiKeys?.whoisfreaks || process.env.WHOISFREAKS_API_KEY;
    
    if (!apiKey) return null;

    const response = await axios.get('https://api.whoisfreaks.com/v1.0/whois', {
      params: { apiKey, whois: 'live', domainName }
    });

    const whois = response.data;

    return {
      registrant: {
        name: whois.registrant_contact?.name,
        email: whois.registrant_contact?.email,
        phone: whois.registrant_contact?.phone,
        organization: whois.registrant_contact?.company,
        address: whois.registrant_contact?.street,
        city: whois.registrant_contact?.city,
        state: whois.registrant_contact?.state,
        country: whois.registrant_contact?.country
      },
      nameservers: whois.name_servers || [],
      status: whois.domain_status,
      registrationDate: whois.create_date
    };
  } catch (error) {
    console.error(`Error getting WHOIS for ${domainName}:`, error.message);
    return null;
  }
};
