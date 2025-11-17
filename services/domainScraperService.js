const puppeteer = require('puppeteer');
const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');
const ScrapedDomain = require('../models/ScrapedDomain');
const domainEnrichmentService = require('./domainEnrichmentService');

class DomainScraperService {
  constructor() {
    this.targetUrl = 'https://newly-registered-domains.whoisxmlapi.com/';
    this.isRunning = false;
  }

  async scrapeNewDomains() {
    if (this.isRunning) {
      throw new Error('Scraping already in progress');
    }

    this.isRunning = true;
    const results = {
      totalProcessed: 0,
      newDomains: 0,
      duplicates: 0,
      errors: 0,
      csvLinks: [],
      skippedDates: [],
      startTime: new Date()
    };

    try {
      console.log('🚀 Starting domain scraper...');

      const csvLinks = await this.findCsvLinks();
      console.log(`📋 Found ${csvLinks.length} CSV links`);

      const processedDates = await ScrapedDomain.distinct('sourceDate');
      console.log(`📋 Already processed dates:`, processedDates);

      for (const link of csvLinks) {
        const dateMatch = link.match(/nrd\.(\d{4}-\d{2}-\d{2})\./);        
        const sourceDate = dateMatch ? dateMatch[1] : null;

        if (sourceDate && processedDates.includes(sourceDate)) {
          console.log(`⏭️ Skipping ${sourceDate} - already processed`);
          results.skippedDates.push(sourceDate);
          continue;
        }

        try {
          await this.processCsvLink(link, sourceDate, results);
        } catch (error) {
          console.error(`❌ Error processing ${link}:`, error.message);
          results.errors++;
        }
      }

      results.endTime = new Date();
      results.duration = (results.endTime - results.startTime) / 1000;
      console.log(`✅ Scraping completed in ${results.duration}s:`, results);
      return results;

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async findCsvLinks() {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      console.log('🌐 Navigating to:', this.targetUrl);
      await page.goto(this.targetUrl, { 
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      console.log('⏳ Waiting for content to load...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const pageInfo = await page.evaluate(() => {
        const info = {
          links: [],
          hasCommonTable: !!document.querySelector('table.common-table'),
          hasAnyTable: !!document.querySelector('table'),
          allCsvLinks: [],
          tableHTML: ''
        };

        const table = document.querySelector('table.common-table');
        if (table) {
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const link = row.querySelector('a[data-href*=".csv"]');
            if (link) {
              const dataHref = link.getAttribute('data-href');
              if (dataHref) {
                const fullUrl = dataHref.startsWith('http') ? dataHref : 'https://newly-registered-domains.whoisxmlapi.com' + dataHref;
                info.links.push(fullUrl);
                info.allCsvLinks.push({
                  href: fullUrl,
                  text: link.textContent?.trim(),
                  dataHref: dataHref
                });
              }
            }
          });
          info.tableHTML = table.outerHTML.substring(0, 500);
        }

        return info;
      });

      console.log('📊 Page analysis:', {
        hasCommonTable: pageInfo.hasCommonTable,
        hasAnyTable: pageInfo.hasAnyTable,
        csvLinksFound: pageInfo.allCsvLinks.length,
        tablePreview: pageInfo.tableHTML
      });
      console.log('🔗 All CSV links:', pageInfo.allCsvLinks);
      console.log(`✅ Found ${pageInfo.links.length} CSV links:`, pageInfo.links);
      
      return pageInfo.links;

    } finally {
      await browser.close();
    }
  }

  async processCsvLink(csvUrl, sourceDate, results) {
    console.log(`📥 Processing: ${csvUrl}`);

    const response = await axios({
      method: 'GET',
      url: csvUrl,
      responseType: 'stream',
      timeout: 60000
    });

    return new Promise((resolve, reject) => {
      const domains = [];
      const stream = Readable.from(response.data);
      
      stream
        .pipe(csv())
        .on('data', (row) => {
          domains.push(row);
        })
        .on('end', async () => {
          console.log(`📦 Loaded ${domains.length} domains from CSV`);
          await this.processDomainsBatch(domains, csvUrl, sourceDate, results);
          console.log(`✅ Finished: ${csvUrl}`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`❌ Stream error: ${error.message}`);
          reject(error);
        });
    });
  }

  async processDomainsBatch(domains, sourceUrl, sourceDate, results) {
    const limitedDomains = domains.slice(0, 5);
    console.log(`🔬 Processing ${limitedDomains.length} domains (testing mode)`);
    
    // Extract domain names and create domain objects
    const domainObjects = limitedDomains.map(row => ({
      name: row.domainName || row.domain || row.Domain || row.domain_name,
      row: row
    })).filter(d => d.name);

    console.log(`\n🚀 Using parallel RDAP enrichment grouped by TLD...`);
    
    // Use the new parallel enrichment method
    const enrichmentResults = await domainEnrichmentService.enrichDomainsInParallel(
      domainObjects.map(d => d.name),
      {
        concurrentPerTLD: 3,  // 3 concurrent requests per RDAP server
        delayBetweenBatches: 1000  // 1 second delay between batches
      }
    );

    // Save enriched domains to database
    console.log(`\n💾 Saving ${enrichmentResults.size} enriched domains to database...`);
    
    for (const [domainName, enrichmentResult] of enrichmentResults) {
      await this.saveDomain(domainName, enrichmentResult, sourceUrl, sourceDate, results);
    }
  }

  async saveDomain(domainName, enrichmentResult, sourceUrl, sourceDate, results) {
    results.totalProcessed++;

    try {
      const existingDomain = await ScrapedDomain.findOne({ domainName });
      if (existingDomain) {
        results.duplicates++;
        console.log(`⏭️  Skipped duplicate: ${domainName}`);
        return;
      }

      const enrichedData = enrichmentResult.data;

      // Use only RDAP data (no CSV fallback in this context)
      const finalRegistrant = {
        name: enrichedData?.registrant?.name || null,
        email: enrichedData?.registrant?.email || null,
        phone: enrichedData?.registrant?.phone || null,
        organization: enrichedData?.registrant?.organization || null,
        country: enrichedData?.registrant?.country || null
      };

      const domainData = {
        domainName,
        tld: this.extractTld(domainName),
        registrationDate: enrichedData?.registrationDate || new Date(),
        registrant: finalRegistrant,
        nameservers: enrichedData?.nameservers || [],
        status: enrichedData?.status || 'active',
        sourceUrl,
        sourceDate,
        enrichmentSource: enrichedData ? 'RDAP' : 'None'
      };

      await ScrapedDomain.create(domainData);
      results.newDomains++;
      
      const hasContact = finalRegistrant.email || finalRegistrant.phone;
      console.log(`✅ Saved ${domainName} (${domainData.enrichmentSource}) - Contact: ${hasContact ? 'Yes' : 'No'}`);

    } catch (error) {
      if (error.code === 11000) {
        results.duplicates++;
        console.log(`⏭️  Duplicate: ${domainName}`);
      } else {
        results.errors++;
        console.error(`❌ Error saving ${domainName}:`, error.message);
      }
    }
  }

  extractTld(domain) {
    if (!domain) return null;
    const parts = domain.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : null;
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  parseNameservers(nsStr) {
    if (!nsStr) return [];
    if (Array.isArray(nsStr)) return nsStr;
    return nsStr.split(',').map(ns => ns.trim()).filter(Boolean);
  }

  getStatus() {
    return {
      isRunning: this.isRunning
    };
  }
}

module.exports = new DomainScraperService();
