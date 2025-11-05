const cron = require('node-cron');
const domainScraperService = require('./domainScraperService');

class DomainScraperScheduler {
  constructor() {
    this.task = null;
  }

  start() {
    const enabled = process.env.ENABLE_DOMAIN_SCRAPER_SCHEDULER === 'true';
    const runOnStartup = process.env.RUN_SCRAPER_ON_STARTUP === 'true';

    if (!enabled) {
      console.log('⏸️ Domain scraper scheduler is disabled');
      return;
    }

    // Run every 12 hours (at 00:00 and 12:00)
    this.task = cron.schedule('0 */12 * * *', async () => {
      console.log('🕐 Scheduled domain scraping started at:', new Date().toISOString());
      
      try {
        const results = await domainScraperService.scrapeNewDomains();
        console.log('✅ Scheduled scraping completed:', results);
      } catch (error) {
        console.error('❌ Scheduled scraping failed:', error.message);
      }
    });

    console.log('⏰ Domain scraper scheduler started - runs every 12 hours');
    
    if (runOnStartup) {
      this.runImmediately();
    }
  }

  async runImmediately() {
    console.log('🚀 Running initial domain scrape on startup...');
    try {
      const results = await domainScraperService.scrapeNewDomains();
      console.log('✅ Initial scraping completed:', results);
    } catch (error) {
      console.error('❌ Initial scraping failed:', error.message);
    }
  }

  stop() {
    if (this.task) {
      this.task.stop();
      console.log('⏹️ Domain scraper scheduler stopped');
    }
  }
}

module.exports = new DomainScraperScheduler();
