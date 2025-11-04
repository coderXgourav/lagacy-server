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
    console.log(`🔬 Processing ${limitedDomains.length} domains (limited for testing)`);
    
    for (const row of limitedDomains) {
      await this.processDomainRow(row, sourceUrl, sourceDate, results);
    }
  }

  async processDomainRow(row, sourceUrl, sourceDate, results) {
    results.totalProcessed++;

    const domainName = row.domainName || row.domain || row.Domain || row.domain_name;
    
    if (!domainName) {
      return;
    }

    try {
      const existingDomain = await ScrapedDomain.findOne({ domainName });
      if (existingDomain) {
        results.duplicates++;
        return;
      }

      console.log(`🔍 Enriching ${domainName}...`);
      console.log(`📄 CSV row data:`, JSON.stringify(row, null, 2));
      
      // Extract CSV data first
      const csvRegistrant = {
        name: row.registrant_name || row.registrantName || row.contactName,
        email: row.registrant_email || row.registrantEmail || row.contactEmail,
        phone: row.registrant_phone || row.registrantPhone || row.contactPhone,
        organization: row.registrant_organization || row.registrantOrganization || row.organization,
        country: row.registrant_country || row.registrantCountry || row.country
      };
      
      // Try WhoisXML first, then WhoisFreaks
      let enrichedData = null;
      const Settings = require('../models/Settings');
      const settings = await Settings.findOne();
      const whoisXmlKey = settings?.apiKeys?.whoisxml;
      const whoisFreaksKey = settings?.apiKeys?.whoisfreaks;
      
      // Try WhoisXML first
      if (whoisXmlKey) {
        console.log(`🔄 Trying WhoisXML for ${domainName}...`);
        enrichedData = await domainEnrichmentService.enrichWithWhoisXML(domainName, whoisXmlKey);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // If WhoisXML fails or returns incomplete data, try WhoisFreaks
      const hasData = enrichedData && (
        enrichedData.registrant?.name || 
        enrichedData.registrant?.email || 
        enrichedData.registrant?.organization
      );
      
      if (!hasData && whoisFreaksKey) {
        console.log(`🔄 Trying WhoisFreaks for ${domainName}...`);
        enrichedData = await domainEnrichmentService.enrichWithWhoisFreaks(domainName, whoisFreaksKey);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      if (!whoisXmlKey && !whoisFreaksKey) {
        console.log('⚠️ No API keys configured, using CSV data only');
      }

      // Merge CSV data with enriched data (enriched data takes priority)
      const finalRegistrant = {
        name: enrichedData?.registrant?.name || csvRegistrant.name || null,
        email: enrichedData?.registrant?.email || csvRegistrant.email || null,
        phone: enrichedData?.registrant?.phone || csvRegistrant.phone || null,
        organization: enrichedData?.registrant?.organization || csvRegistrant.organization || null,
        country: enrichedData?.registrant?.country || csvRegistrant.country || null
      };

      const domainData = {
        domainName,
        tld: this.extractTld(domainName),
        registrationDate: enrichedData?.registrationDate || this.parseDate(row.create_date || row.createdDate || row.registrationDate),
        registrant: finalRegistrant,
        nameservers: enrichedData?.nameservers || this.parseNameservers(row.name_servers || row.nameServers) || [],
        status: enrichedData?.status || row.status || row.domainStatus,
        sourceUrl,
        sourceDate,
        enrichmentSource: enrichedData?.source || 'CSV'
      };

      console.log(`💾 Saving domain data:`, JSON.stringify(domainData, null, 2));
      await ScrapedDomain.create(domainData);
      results.newDomains++;
      
      const hasContact = finalRegistrant.email || finalRegistrant.phone;
      console.log(`✅ Saved ${domainName} (${domainData.enrichmentSource}) - Contact: ${hasContact ? 'Yes' : 'No'}`);

    } catch (error) {
      if (error.code === 11000) {
        results.duplicates++;
      } else {
        console.error(`❌ Error processing ${domainName}:`, error.message);
        results.errors++;
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
