# Domain Scraper Scheduler

## Overview
The domain scraper now runs automatically every 12 hours to fetch and process newly registered domains.

## Configuration

Add these environment variables to your `.env` file:

```env
# Domain Scraper Scheduler
ENABLE_DOMAIN_SCRAPER_SCHEDULER=true    # Enable/disable automatic scraping
RUN_SCRAPER_ON_STARTUP=false            # Run scraper immediately when server starts
```

## Schedule
- Runs every 12 hours at **00:00** and **12:00**
- Uses cron pattern: `0 */12 * * *`

## How It Works
1. Server starts and initializes the scheduler
2. Scheduler runs at configured intervals
3. Each run:
   - Scrapes CSV links from whoisxmlapi.com
   - Skips already processed dates
   - Enriches domains with WhoisXML/WhoisFreaks APIs
   - Saves to MongoDB

## Manual Control
You can still trigger scraping manually via API:
```bash
POST /api/domain-scraper/trigger-scrape
```

## Logs
Watch for these log messages:
- `⏰ Domain scraper scheduler started` - Scheduler initialized
- `🕐 Scheduled domain scraping started` - Scraping job started
- `✅ Scheduled scraping completed` - Job finished successfully
- `❌ Scheduled scraping failed` - Job encountered an error

## Disable Scheduler
Set `ENABLE_DOMAIN_SCRAPER_SCHEDULER=false` in `.env` and restart the server.
