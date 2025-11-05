const axios = require('axios');
const rdapBootstrap = require('./rdapBootstrap.json');

class DomainEnrichmentService {
  constructor() {
    this.rdapServers = rdapBootstrap;
    this.requestQueue = new Map();
    this.lastRequestTime = new Map();
    this.minDelay = 2000;
    this.countryCodeMap = {
      '1': 'US', '7': 'RU', '20': 'EG', '27': 'ZA', '30': 'GR', '31': 'NL', '32': 'BE', '33': 'FR',
      '34': 'ES', '36': 'HU', '39': 'IT', '40': 'RO', '41': 'CH', '43': 'AT', '44': 'GB', '45': 'DK',
      '46': 'SE', '47': 'NO', '48': 'PL', '49': 'DE', '51': 'PE', '52': 'MX', '53': 'CU', '54': 'AR',
      '55': 'BR', '56': 'CL', '57': 'CO', '58': 'VE', '60': 'MY', '61': 'AU', '62': 'ID', '63': 'PH',
      '64': 'NZ', '65': 'SG', '66': 'TH', '81': 'JP', '82': 'KR', '84': 'VN', '86': 'CN', '90': 'TR',
      '91': 'IN', '92': 'PK', '93': 'AF', '94': 'LK', '95': 'MM', '98': 'IR', '212': 'MA', '213': 'DZ',
      '216': 'TN', '218': 'LY', '220': 'GM', '221': 'SN', '222': 'MR', '223': 'ML', '224': 'GN',
      '225': 'CI', '226': 'BF', '227': 'NE', '228': 'TG', '229': 'BJ', '230': 'MU', '231': 'LR',
      '232': 'SL', '233': 'GH', '234': 'NG', '235': 'TD', '236': 'CF', '237': 'CM', '238': 'CV',
      '239': 'ST', '240': 'GQ', '241': 'GA', '242': 'CG', '243': 'CD', '244': 'AO', '245': 'GW',
      '246': 'IO', '248': 'SC', '249': 'SD', '250': 'RW', '251': 'ET', '252': 'SO', '253': 'DJ',
      '254': 'KE', '255': 'TZ', '256': 'UG', '257': 'BI', '258': 'MZ', '260': 'ZM', '261': 'MG',
      '262': 'RE', '263': 'ZW', '264': 'NA', '265': 'MW', '266': 'LS', '267': 'BW', '268': 'SZ',
      '269': 'KM', '290': 'SH', '291': 'ER', '297': 'AW', '298': 'FO', '299': 'GL', '350': 'GI',
      '351': 'PT', '352': 'LU', '353': 'IE', '354': 'IS', '355': 'AL', '356': 'MT', '357': 'CY',
      '358': 'FI', '359': 'BG', '370': 'LT', '371': 'LV', '372': 'EE', '373': 'MD', '374': 'AM',
      '375': 'BY', '376': 'AD', '377': 'MC', '378': 'SM', '380': 'UA', '381': 'RS', '382': 'ME',
      '383': 'XK', '385': 'HR', '386': 'SI', '387': 'BA', '389': 'MK', '420': 'CZ', '421': 'SK',
      '423': 'LI', '500': 'FK', '501': 'BZ', '502': 'GT', '503': 'SV', '504': 'HN', '505': 'NI',
      '506': 'CR', '507': 'PA', '508': 'PM', '509': 'HT', '590': 'GP', '591': 'BO', '592': 'GY',
      '593': 'EC', '594': 'GF', '595': 'PY', '596': 'MQ', '597': 'SR', '598': 'UY', '599': 'CW',
      '670': 'TL', '672': 'NF', '673': 'BN', '674': 'NR', '675': 'PG', '676': 'TO', '677': 'SB',
      '678': 'VU', '679': 'FJ', '680': 'PW', '681': 'WF', '682': 'CK', '683': 'NU', '685': 'WS',
      '686': 'KI', '687': 'NC', '688': 'TV', '689': 'PF', '690': 'TK', '691': 'FM', '692': 'MH',
      '850': 'KP', '852': 'HK', '853': 'MO', '855': 'KH', '856': 'LA', '880': 'BD', '886': 'TW',
      '960': 'MV', '961': 'LB', '962': 'JO', '963': 'SY', '964': 'IQ', '965': 'KW', '966': 'SA',
      '967': 'YE', '968': 'OM', '970': 'PS', '971': 'AE', '972': 'IL', '973': 'BH', '974': 'QA',
      '975': 'BT', '976': 'MN', '977': 'NP', '992': 'TJ', '993': 'TM', '994': 'AZ', '995': 'GE',
      '996': 'KG', '998': 'UZ'
    };
  }

  getCountryFromPhone(phone) {
    if (!phone) return null;
    const cleaned = phone.replace(/[^0-9]/g, '');
    for (let len = 3; len >= 1; len--) {
      const code = cleaned.substring(0, len);
      if (this.countryCodeMap[code]) {
        return this.countryCodeMap[code];
      }
    }
    return null;
  }

  getRdapServer(domain) {
    const tld = domain.split('.').pop().toLowerCase();
    return this.rdapServers[tld] || 'https://rdap.org/';
  }

  async waitForRateLimit(server) {
    const lastTime = this.lastRequestTime.get(server) || 0;
    const now = Date.now();
    const timeSinceLastRequest = now - lastTime;
    
    if (timeSinceLastRequest < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms for ${server}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime.set(server, Date.now());
  }
  async enrichWithRDAP(domainName, retries = 3) {
    const rdapServer = this.getRdapServer(domainName);
    const rdapUrl = `${rdapServer}domain/${domainName}`;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.waitForRateLimit(rdapServer);
        
        console.log(`🔍 Using RDAP server: ${rdapUrl} (attempt ${attempt + 1}/${retries})`);
        
        const response = await axios.get(rdapUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

      const data = response.data;
      console.log(`📡 RDAP response for ${domainName}:`, JSON.stringify(data, null, 2));
      
      const entities = data.entities || [];
      let registrant = {};
      
      // Try to find registrant, admin, or technical contact
      for (const entity of entities) {
        const roles = entity.roles || [];
        if (roles.includes('registrant') || roles.includes('administrative') || roles.includes('technical')) {
          const vcard = entity.vcardArray?.[1] || [];
          console.log(`📇 vCard data for ${roles.join(',')}:`, JSON.stringify(vcard, null, 2));
          
          const name = vcard.find(v => v[0] === 'fn')?.[3];
          const email = vcard.find(v => v[0] === 'email')?.[3];
          const org = vcard.find(v => v[0] === 'org')?.[3];
          const tel = vcard.find(v => v[0] === 'tel')?.[3];
          const country = vcard.find(v => v[0] === 'adr')?.[1]?.cc;
          
          // Only use if we have at least some data
          if (name || email || org || tel) {
            const cleanPhone = tel?.replace('tel:', '') || null;
            registrant = {
              name: name || null,
              email: email || null,
              organization: org || null,
              phone: cleanPhone,
              country: country || this.getCountryFromPhone(cleanPhone)
            };
            break;
          }
        }
      }
      
      // If no registrant found, try registrar abuse contact
      if (!registrant.email && !registrant.name) {
        for (const entity of entities) {
          if (entity.roles?.includes('registrar')) {
            const abuseEntity = entity.entities?.find(e => e.roles?.includes('abuse'));
            if (abuseEntity) {
              const vcard = abuseEntity.vcardArray?.[1] || [];
              const email = vcard.find(v => v[0] === 'email')?.[3];
              const tel = vcard.find(v => v[0] === 'tel')?.[3];
              const name = vcard.find(v => v[0] === 'fn')?.[3];
              
              if (email || tel || name) {
                const cleanPhone = tel?.replace('tel:', '').replace('uri', '').trim() || null;
                registrant = {
                  name: name || null,
                  email: email || null,
                  organization: name || null,
                  phone: cleanPhone,
                  country: this.getCountryFromPhone(cleanPhone)
                };
                console.log(`📇 Using registrar abuse contact as fallback`);
                break;
              }
            }
          }
        }
      }

      // Try to infer country from other sources if still missing
      if (!registrant.country) {
        // Check address in vCard for country
        for (const entity of entities) {
          const vcard = entity.vcardArray?.[1] || [];
          const adr = vcard.find(v => v[0] === 'adr');
          if (adr && adr[1]?.country) {
            registrant.country = adr[1].country;
            break;
          }
          // Check for country in address array (last element is often country)
          if (adr && Array.isArray(adr[3]) && adr[3][6]) {
            registrant.country = adr[3][6];
            break;
          }
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
        const isRateLimited = error.response?.status === 429;
        const isServerError = error.response?.status >= 500;
        const isLastAttempt = attempt === retries - 1;
        
        console.log(`❌ RDAP error for ${domainName} (attempt ${attempt + 1}):`, error.message);
        
        if (isRateLimited || isServerError) {
          if (!isLastAttempt) {
            const backoffTime = Math.min(5000 * Math.pow(2, attempt), 30000);
            console.log(`⏳ Backing off for ${backoffTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }
        }
        
        if (isLastAttempt) {
          return null;
        }
      }
    }
    return null;
  }



  async enrichDomain(domainName) {
    return await this.enrichWithRDAP(domainName);
  }
}

module.exports = new DomainEnrichmentService();
