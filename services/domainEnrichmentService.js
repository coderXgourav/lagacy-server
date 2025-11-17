const axios = require('axios');
const rdapBootstrap = require('./rdapBootstrap.json');

class DomainEnrichmentService {
  constructor() {
    this.rdapServers = rdapBootstrap;
    this.requestQueue = new Map();
    this.lastRequestTime = new Map();
    this.rateLimitTracker = new Map(); // Track rate-limited servers
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

  getRdapServer(domain, fallbackIndex = 0) {
    const tld = domain.split('.').pop().toLowerCase();
    const primaryServer = this.rdapServers[tld] || 'https://rdap.org/';
    
    // Fallback RDAP servers (alternative servers to try if primary fails)
    const fallbackServers = [
      primaryServer,
      'https://rdap.org/domain/',  // Universal RDAP fallback
      `https://rdap.iana.org/domain/`,  // IANA RDAP service
      `https://www.rdap.net/domain/`  // Public RDAP aggregator
    ];
    
    return fallbackServers[fallbackIndex] || fallbackServers[0];
  }

  /**
   * Track rate limit status for each RDAP server
   */
  isServerRateLimited(server) {
    const rateLimitInfo = this.rateLimitTracker.get(server);
    if (!rateLimitInfo) return false;
    
    const now = Date.now();
    // If rate limited and cooldown period not passed, return true
    if (rateLimitInfo.rateLimited && now < rateLimitInfo.cooldownUntil) {
      return true;
    }
    
    // Cooldown period passed, reset rate limit
    if (now >= rateLimitInfo.cooldownUntil) {
      this.rateLimitTracker.delete(server);
    }
    
    return false;
  }

  /**
   * Mark server as rate limited with cooldown period
   */
  markServerRateLimited(server, cooldownMinutes = 5) {
    const cooldownMs = cooldownMinutes * 60 * 1000;
    this.rateLimitTracker.set(server, {
      rateLimited: true,
      cooldownUntil: Date.now() + cooldownMs,
      timestamp: Date.now()
    });
    console.log(`🚫 Server ${server} marked as rate limited. Cooldown: ${cooldownMinutes} minutes`);
  }

  async waitForRateLimit(server) {
    const lastTime = this.lastRequestTime.get(server) || 0;
    const now = Date.now();
    const timeSinceLastRequest = now - lastTime;
    
    // Get adaptive delay for this server (increases if we've had rate limit issues)
    const adaptiveDelay = this.getAdaptiveDelay(server);
    
    if (timeSinceLastRequest < adaptiveDelay) {
      const waitTime = adaptiveDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms for ${server}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime.set(server, Date.now());
  }

  /**
   * Get adaptive delay for a server based on its rate limit history
   * Increases delay if server has been rate limited recently
   */
  getAdaptiveDelay(server) {
    const rateLimitInfo = this.rateLimitTracker.get(server);
    
    if (!rateLimitInfo) {
      return this.minDelay; // Default 2000ms
    }
    
    // If recently rate limited (within last 10 minutes), increase delay
    const timeSinceRateLimit = Date.now() - rateLimitInfo.timestamp;
    const tenMinutes = 10 * 60 * 1000;
    
    if (timeSinceRateLimit < tenMinutes) {
      return this.minDelay * 2; // Double the delay (4000ms)
    }
    
    return this.minDelay;
  }

  /**
   * Get rate limit status report for monitoring
   */
  getRateLimitStatus() {
    const status = {
      servers: [],
      totalRateLimited: 0
    };
    
    for (const [server, info] of this.rateLimitTracker) {
      const remainingCooldown = Math.max(0, info.cooldownUntil - Date.now());
      status.servers.push({
        server,
        rateLimited: info.rateLimited,
        remainingCooldown: Math.ceil(remainingCooldown / 1000), // seconds
        timestamp: new Date(info.timestamp).toISOString()
      });
      if (info.rateLimited) status.totalRateLimited++;
    }
    
    return status;
  }
  async enrichWithRDAP(domainName, retries = 3, fallbackServerIndex = 0) {
    const maxFallbackServers = 4; // We have 4 fallback servers
    
    // If all fallback servers exhausted, return null
    if (fallbackServerIndex >= maxFallbackServers) {
      console.log(`❌ All RDAP servers exhausted for ${domainName}`);
      return null;
    }
    
    const rdapServer = this.getRdapServer(domainName, fallbackServerIndex);
    
    // Check if this server is currently rate limited
    if (this.isServerRateLimited(rdapServer)) {
      console.log(`⏭️  Server ${rdapServer} is rate limited, trying next fallback...`);
      return await this.enrichWithRDAP(domainName, retries, fallbackServerIndex + 1);
    }
    
    const rdapUrl = rdapServer.endsWith('/') 
      ? `${rdapServer}${domainName}` 
      : `${rdapServer}domain/${domainName}`;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.waitForRateLimit(rdapServer);
        
        console.log(`🔍 Using RDAP server: ${rdapUrl} (attempt ${attempt + 1}/${retries}, fallback ${fallbackServerIndex})`);
        
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
        const isForbidden = error.response?.status === 403;
        const isLastAttempt = attempt === retries - 1;
        
        console.log(`❌ RDAP error for ${domainName} (attempt ${attempt + 1}):`, error.message);
        
        // Handle rate limiting - mark server and try fallback
        if (isRateLimited) {
          this.markServerRateLimited(rdapServer, 5); // 5 minute cooldown
          console.log(`🔄 Switching to fallback server due to rate limit...`);
          return await this.enrichWithRDAP(domainName, retries, fallbackServerIndex + 1);
        }
        
        // Handle forbidden - try fallback immediately
        if (isForbidden) {
          console.log(`🔄 Server blocked request (403), trying fallback server...`);
          return await this.enrichWithRDAP(domainName, retries, fallbackServerIndex + 1);
        }
        
        // Handle server errors with retry
        if (isServerError) {
          if (!isLastAttempt) {
            const backoffTime = Math.min(5000 * Math.pow(2, attempt), 30000);
            console.log(`⏳ Server error, backing off for ${backoffTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          } else {
            // Last attempt, try fallback server
            console.log(`🔄 Max retries on server errors, trying fallback server...`);
            return await this.enrichWithRDAP(domainName, retries, fallbackServerIndex + 1);
          }
        }
        
        // For other errors, try next attempt or fallback
        if (isLastAttempt) {
          console.log(`🔄 Max retries reached, trying fallback server...`);
          return await this.enrichWithRDAP(domainName, retries, fallbackServerIndex + 1);
        }
      }
    }
    return null;
  }



  async enrichDomain(domainName) {
    return await this.enrichWithRDAP(domainName);
  }

  /**
   * Group domains by their TLD
   */
  groupDomainsByTLD(domains) {
    const grouped = {};
    
    for (const domain of domains) {
      const domainName = typeof domain === 'string' ? domain : domain.name;
      const tld = domainName.split('.').pop().toLowerCase();
      
      if (!grouped[tld]) {
        grouped[tld] = [];
      }
      grouped[tld].push(domain);
    }
    
    return grouped;
  }

  /**
   * Enrich multiple domains in parallel, grouped by TLD
   * This allows parallel processing across different RDAP servers
   * while respecting rate limits per server
   */
  async enrichDomainsInParallel(domains, options = {}) {
    const {
      concurrentPerTLD = 3,  // Number of concurrent requests per TLD/server
      delayBetweenBatches = 1000,
      maxRetriesPerDomain = 2,  // Max retries before giving up on a domain
      enableProgressTracking = true
    } = options;

    console.log(`\n🚀 Starting parallel RDAP enrichment for ${domains.length} domains...`);
    console.log(`⚙️  Config: ${concurrentPerTLD} concurrent per TLD, ${delayBetweenBatches}ms delay between batches`);
    
    // Group domains by TLD
    const groupedByTLD = this.groupDomainsByTLD(domains);
    const tlds = Object.keys(groupedByTLD);
    
    console.log(`📊 Grouped into ${tlds.length} TLDs: ${tlds.join(', ')}`);
    tlds.forEach(tld => {
      console.log(`   - ${tld}: ${groupedByTLD[tld].length} domains`);
    });

    // Check current rate limit status
    const rateLimitStatus = this.getRateLimitStatus();
    if (rateLimitStatus.totalRateLimited > 0) {
      console.log(`\n⚠️  Warning: ${rateLimitStatus.totalRateLimited} RDAP servers currently rate limited:`);
      rateLimitStatus.servers.forEach(s => {
        if (s.rateLimited) {
          console.log(`   - ${s.server}: Cooldown ${s.remainingCooldown}s remaining`);
        }
      });
    }

    const results = new Map();
    const progressTracker = {
      total: domains.length,
      processed: 0,
      successful: 0,
      failed: 0,
      rateLimited: 0
    };
    
    // Process each TLD group in parallel
    const tldPromises = tlds.map(async (tld) => {
      const domainsForTld = groupedByTLD[tld];
      const rdapServer = this.getRdapServer(`example.${tld}`);
      
      console.log(`\n🔧 Processing ${domainsForTld.length} .${tld} domains using ${rdapServer}`);
      
      // Process domains for this TLD in batches
      for (let i = 0; i < domainsForTld.length; i += concurrentPerTLD) {
        const batch = domainsForTld.slice(i, i + concurrentPerTLD);
        const batchNum = Math.floor(i / concurrentPerTLD) + 1;
        const totalBatches = Math.ceil(domainsForTld.length / concurrentPerTLD);
        
        console.log(`   ⚡ TLD ${tld} - Batch ${batchNum}/${totalBatches} (${batch.length} domains)`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (domain) => {
          const domainName = typeof domain === 'string' ? domain : domain.name;
          try {
            const enrichedData = await this.enrichWithRDAP(domainName, maxRetriesPerDomain);
            const success = !!enrichedData;
            
            results.set(domainName, {
              domain: domain,
              data: enrichedData,
              success: success
            });
            
            progressTracker.processed++;
            if (success) {
              progressTracker.successful++;
            } else {
              progressTracker.failed++;
            }
            
            return { domainName, success };
          } catch (error) {
            results.set(domainName, {
              domain: domain,
              data: null,
              success: false,
              error: error.message
            });
            
            progressTracker.processed++;
            progressTracker.failed++;
            
            return { domainName, success: false, error: error.message };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const successCount = batchResults.filter(r => r.success).length;
        console.log(`   ✓ TLD ${tld} - Batch ${batchNum} complete: ${successCount}/${batch.length} successful`);
        
        // Show overall progress
        if (enableProgressTracking) {
          const progressPct = ((progressTracker.processed / progressTracker.total) * 100).toFixed(1);
          console.log(`   📊 Overall Progress: ${progressTracker.processed}/${progressTracker.total} (${progressPct}%) - ✅ ${progressTracker.successful} | ❌ ${progressTracker.failed}`);
        }
        
        // Delay between batches for the same TLD to respect rate limits
        if (i + concurrentPerTLD < domainsForTld.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
      
      const tldSuccessCount = Array.from(results.values()).filter(
        r => r.success && (typeof r.domain === 'string' ? r.domain : r.domain.name).endsWith(`.${tld}`)
      ).length;
      console.log(`   ✅ TLD ${tld} complete: ${tldSuccessCount}/${domainsForTld.length} enriched`);
    });
    
    // Wait for all TLDs to complete
    await Promise.all(tldPromises);
    
    // Summary
    const totalSuccess = Array.from(results.values()).filter(r => r.success).length;
    const totalFailed = results.size - totalSuccess;
    const successRate = ((totalSuccess / domains.length) * 100).toFixed(1);
    
    // Get final rate limit status
    const finalRateLimitStatus = this.getRateLimitStatus();
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ PARALLEL RDAP ENRICHMENT COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 Total domains: ${domains.length}`);
    console.log(`✓ Successfully enriched: ${totalSuccess} (${successRate}%)`);
    console.log(`✗ Failed: ${totalFailed}`);
    console.log(`📡 RDAP servers used: ${tlds.length}`);
    
    if (finalRateLimitStatus.totalRateLimited > 0) {
      console.log(`\n⚠️  Rate Limited Servers: ${finalRateLimitStatus.totalRateLimited}`);
      finalRateLimitStatus.servers.forEach(s => {
        if (s.rateLimited) {
          console.log(`   - ${s.server}: ${s.remainingCooldown}s cooldown remaining`);
        }
      });
    }
    
    console.log(`${'='.repeat(80)}\n`);
    
    return results;
  }
}

module.exports = new DomainEnrichmentService();
