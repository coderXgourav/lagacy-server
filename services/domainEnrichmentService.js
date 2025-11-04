const axios = require('axios');
const Settings = require('../models/Settings');

class DomainEnrichmentService {
  async enrichWithRDAP(domainName) {
    try {
      const response = await axios.get(`https://rdap.org/domain/${domainName}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const data = response.data;
      console.log(`📡 RDAP response for ${domainName}:`, JSON.stringify(data, null, 2));
      
      const entities = data.entities || [];
      let registrant = {};
      
      // Try to find registrant entity
      for (const entity of entities) {
        const roles = entity.roles || [];
        if (roles.includes('registrant') || roles.includes('registrar')) {
          const vcard = entity.vcardArray?.[1] || [];
          console.log(`📇 vCard data:`, JSON.stringify(vcard, null, 2));
          
          registrant = {
            name: vcard.find(v => v[0] === 'fn')?.[3],
            email: vcard.find(v => v[0] === 'email')?.[3],
            organization: vcard.find(v => v[0] === 'org')?.[3],
            phone: vcard.find(v => v[0] === 'tel')?.[3],
            country: vcard.find(v => v[0] === 'adr')?.[1]?.cc
          };
          break;
        }
      }

      const result = {
        registrant,
        nameservers: data.nameservers?.map(ns => ns.ldhName) || [],
        status: data.status?.[0],
        registrationDate: data.events?.find(e => e.eventAction === 'registration')?.eventDate,
        source: 'RDAP'
      };
      
      console.log(`✅ RDAP parsed result:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.log(`❌ RDAP error for ${domainName}:`, error.message);
      if (error.response?.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      return null;
    }
  }

  async enrichWithWhoisFreaks(domainName, apiKey) {
    if (!apiKey) {
      console.log('⚠️ WhoisFreaks API key not configured');
      return null;
    }

    try {
      console.log(`🔑 Using WhoisFreaks API key: ${apiKey.substring(0, 10)}...`);
      console.log(`🌐 Calling WhoisFreaks API for ${domainName}`);
      
      const response = await axios.get('https://api.whoisfreaks.com/v1.0/whois', {
        params: { 
          whois: 'live', 
          domainName: domainName,
          apiKey: apiKey
        },
        timeout: 10000
      });

      console.log(`📊 WhoisFreaks status: ${response.status}`);
      const data = response.data;
      console.log(`📡 WhoisFreaks response for ${domainName}:`, JSON.stringify(data, null, 2));
      
      const result = {
        registrant: {
          name: data.registrant_contact?.name,
          email: data.registrant_contact?.email,
          phone: data.registrant_contact?.phone,
          organization: data.registrant_contact?.company || data.registrant_contact?.organization,
          country: data.registrant_contact?.country,
        },
        nameservers: data.name_servers || [],
        status: data.domain_status,
        registrationDate: data.create_date,
        source: 'WhoisFreaks'
      };
      
      console.log(`✅ WhoisFreaks parsed result:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.log(`❌ WhoisFreaks failed for ${domainName}:`, error.message);
      if (error.response) {
        console.log(`📛 Response status: ${error.response.status}`);
        console.log(`📛 Response data:`, JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  async enrichWithWhoisXML(domainName, apiKey) {
    if (!apiKey) {
      console.log('⚠️ WhoisXML API key not configured');
      return null;
    }

    try {
      const response = await axios.get('https://www.whoisxmlapi.com/whoisserver/WhoisService', {
        params: {
          apiKey,
          domainName,
          outputFormat: 'JSON'
        },
        timeout: 10000
      });

      const data = response.data.WhoisRecord;
      return {
        registrant: {
          name: data.registrant?.name,
          email: data.registrant?.email,
          phone: data.registrant?.telephone,
          organization: data.registrant?.organization,
          country: data.registrant?.country,
        },
        nameservers: data.nameServers?.hostNames || [],
        status: data.status,
        source: 'WhoisXML'
      };
    } catch (error) {
      console.log(`⚠️ WhoisXML failed for ${domainName}: ${error.message}`);
      return null;
    }
  }

  async enrichDomain(domainName) {
    let enrichedData = await this.enrichWithRDAP(domainName);
    if (enrichedData) {
      return enrichedData;
    }

    return null;
  }
}

module.exports = new DomainEnrichmentService();
