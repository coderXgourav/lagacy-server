# Hunter.io Integration Summary

## Overview
Hunter.io email enrichment has been successfully integrated into three key features:
1. **Low Rating Businesses** - Find emails for businesses with low ratings
2. **No Website Businesses** - Find emails for businesses without websites
3. **New Domains** - Find contact emails for newly registered domains

## What Was Implemented

### 1. Hunter Service (`services/hunterService.js`)
Created a centralized Hunter.io service with:
- `findEmailsByDomain(domain)` - Find emails for a specific domain
- `enrichBusinessWithEmail(business)` - Enrich single business with email
- `enrichBusinessesWithEmails(businesses, options)` - Batch enrich multiple businesses
- Smart rate limiting and retry logic
- Domain filtering (skips social media and aggregator sites)
- Email prioritization (generic emails like info@, contact@ first)

**Features:**
- Automatic retry on rate limits (429 errors)
- Configurable batch processing
- Skip social media domains (Facebook, Instagram, etc.)
- Timeout handling
- Error logging without breaking the flow

### 2. Low Rating Integration
**File:** `controllers/lowRatingController.js`

**Changes:**
- Added Hunter service import
- Enriches all businesses with emails after Google/Yelp search
- Uses batch processing (5 businesses at a time)
- Respects existing emails (skipIfHasEmail option)
- Saves emails to `LowRatingBusiness` model

**Result:** Phone numbers AND emails are now available for low-rated businesses

### 3. No Website Integration
**File:** `controllers/noWebsiteController.js`

**Changes:**
- Added Hunter service import
- Attempts to find emails for businesses with Facebook pages
- Uses business name as domain hint when no website exists
- Enriches during the Facebook enrichment phase
- Saves emails to `NoWebsiteBusiness` model

**Result:** Businesses without websites now have email contact information when available

### 4. New Domains Integration
**File:** `controllers/newDomainController.js`

**Changes:**
- Added Hunter service for both CT (Certificate Transparency) and WHOIS sources
- Enriches domains from Certificate Transparency with Hunter emails
- Falls back to Hunter if WHOIS doesn't provide registrant email
- Saves emails to `NewDomain.registrant.email` field

**Result:** New domains now have contact emails for outreach

## API Key Configuration

The Hunter API key is managed through the **Settings** interface in the frontend:

1. Users configure the Hunter API key in the Settings page
2. Key is stored in `Settings.apiKeys.hunter` in MongoDB
3. The Hunter service automatically retrieves it from Settings
4. Falls back to `process.env.HUNTER_API_KEY` if not set in Settings

**No manual .env configuration needed** - it's all handled through the UI!

## Rate Limiting & Performance

The Hunter service includes intelligent rate limiting:
- **Batch size:** 5 concurrent requests
- **Delay between batches:** 1000ms (1 second)
- **Retry logic:** Up to 2 retries with exponential backoff
- **Timeout:** 10 seconds per request

This ensures:
- ✅ Respectful API usage
- ✅ No rate limit violations
- ✅ Fast processing for small batches
- ✅ Reliable operation for large batches

## Email Prioritization

Hunter returns multiple emails per domain. The service prioritizes:
1. **Generic emails** (info@, contact@, hello@, support@, sales@)
2. **Personal emails** (individual employee emails)
3. **Maximum 3 emails** returned per domain

## Error Handling

The integration is robust:
- ✅ Continues processing if Hunter API fails
- ✅ Logs errors without breaking the search
- ✅ Handles 404 (domain not found) gracefully
- ✅ Retries on network timeouts
- ✅ Backs off on rate limits (429 errors)

## Database Fields

### LowRatingBusiness
- `email` - Single primary email (String)

### NoWebsiteBusiness
- `email` - Single primary email (String)

### NewDomain
- `registrant.email` - Registrant/contact email (String)

## Usage Example

Users just need to:
1. Add Hunter API key in Settings page (frontend)
2. Run searches as normal
3. Results will automatically include emails when available

## Testing

To verify the integration:
1. Add a valid Hunter.io API key in Settings
2. Run a Low Rating search
3. Run a No Website search
4. Run a New Domain search
5. Check that email fields are populated in the results

## Benefits

✅ **Automated email discovery** - No manual lookup needed
✅ **Multi-source enrichment** - Combines Google, Yelp, Facebook, and Hunter data
✅ **Better lead quality** - Contact info (phone + email) for outreach
✅ **Seamless integration** - Works automatically in background
✅ **Cost-effective** - Batch processing and rate limiting minimize API costs

## Files Modified

1. ✅ `services/hunterService.js` - NEW (Hunter service)
2. ✅ `controllers/lowRatingController.js` - Added email enrichment
3. ✅ `controllers/noWebsiteController.js` - Added email enrichment
4. ✅ `controllers/newDomainController.js` - Added email enrichment

## Next Steps

1. Configure Hunter API key in Settings UI
2. Test with real searches
3. Monitor Hunter API usage/quota
4. Adjust batch sizes if needed for faster/slower processing

---

**Hunter.io Integration Complete! 🎉**
