# Legacy Website Finder - Documentation

## Overview
The Legacy Website Finder is an AI-powered service that discovers businesses with outdated websites (registered before Jan 1, 2020) and finds their contact information for outreach purposes.

## Features
- ✅ Discover businesses using Google Places API
- ✅ Check domain registration dates via WhoisXML API
- ✅ Filter legacy websites (pre-2020)
- ✅ Find business emails using Hunter.io
- ✅ Store results in MongoDB
- ✅ Export to Excel for outreach campaigns

## Project Structure
```
lagacy-server/
├── src/
│   ├── agents/
│   │   ├── discoveryAgent.js       # Google Places integration
│   │   ├── domainAgeAgent.js       # WhoisXML integration
│   │   ├── filterAgent.js          # Legacy website filter
│   │   ├── contactFinderAgent.js   # Hunter.io integration
│   │   └── excelExporter.js        # Excel export functionality
│   ├── models/
│   │   └── Business.js             # MongoDB schema
│   ├── routes/
│   │   ├── scanRoute.js            # POST /api/scan endpoint
│   │   └── downloadRoute.js        # GET /api/download endpoint
│   └── utils/
│       └── logger.js               # Logging utility
```

## API Endpoints

### 1. POST /api/scan
Triggers the full pipeline to discover and analyze legacy websites.

**Request Body:**
```json
{
  "location": "Kolkata, West Bengal, India",
  "businessCategory": "restaurants"
}
```

**Response:**
```json
{
  "message": "Scan complete",
  "count": 24,
  "data": [
    {
      "businessName": "Example Restaurant",
      "category": "restaurant",
      "phone": "+91 1234567890",
      "address": "123 Main St, Kolkata",
      "website": "https://example.com",
      "domainCreationDate": "2015-03-15T00:00:00.000Z",
      "isLegacy": true,
      "emails": ["info@example.com", "contact@example.com"],
      "location": {
        "city": "Kolkata",
        "state": "West Bengal",
        "country": "India"
      }
    }
  ]
}
```

### 2. GET /api/download
Exports all legacy websites to an Excel file.

**Response:**
- Downloads `legacy-websites.xlsx` file
- Contains columns: Business Name, Category, Phone, Email(s), Website, Domain Creation Date, Address, Location

## Environment Variables
Ensure your `.env` file contains:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/lagacy-agent
whoisxml=YOUR_WHOISXML_API_KEY
hunter=YOUR_HUNTER_API_KEY
googlePlaces=YOUR_GOOGLE_PLACES_API_KEY
```

## Installation & Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Start MongoDB:**
```bash
# Make sure MongoDB is running on localhost:27017
```

3. **Run the server:**
```bash
npm start
# or for development
npm run dev
```

## Usage Examples

### Using cURL:

**Scan for legacy websites:**
```bash
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Mumbai, Maharashtra, India",
    "businessCategory": "hotels"
  }'
```

**Download Excel report:**
```bash
curl -O http://localhost:5000/api/download
```

### Using JavaScript (fetch):

```javascript
// Trigger scan
const scanResponse = await fetch('http://localhost:5000/api/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    location: 'Delhi, India',
    businessCategory: 'lawyers'
  })
});
const result = await scanResponse.json();
console.log(`Found ${result.count} legacy websites`);

// Download Excel
window.location.href = 'http://localhost:5000/api/download';
```

## Pipeline Workflow

1. **Discovery Agent** → Finds businesses via Google Places API
2. **Domain Age Agent** → Checks domain registration dates via WhoisXML
3. **Filter Agent** → Keeps only domains created before Jan 1, 2020
4. **Contact Finder Agent** → Finds emails via Hunter.io
5. **MongoDB Storage** → Saves results to database
6. **Excel Export** → Generates downloadable report

## Rate Limiting & Performance

- **Domain Age Checks:** 500ms delay between requests
- **Email Lookups:** 1000ms delay between requests
- **Retries:** 2 automatic retries for failed API calls
- **Email Limit:** Maximum 3 emails per business

## Error Handling

All agents include:
- Automatic retry logic (2 attempts)
- Comprehensive error logging
- Graceful degradation (continues processing even if some businesses fail)

## MongoDB Schema

```javascript
{
  businessName: String,
  category: String,
  phone: String,
  address: String,
  website: String,
  domainCreationDate: String,
  isLegacy: Boolean,
  emails: [String],
  location: {
    city: String,
    state: String,
    country: String
  },
  scannedAt: Date
}
```

## Troubleshooting

**No businesses found:**
- Check if Google Places API key is valid
- Try a different location or broader search term

**Domain age not detected:**
- Verify WhoisXML API key and quota
- Some domains may not have public WHOIS data

**No emails found:**
- Check Hunter.io API key and monthly quota
- Some domains may not have discoverable emails

**Excel download fails:**
- Ensure at least one legacy website exists in database
- Check server logs for specific errors

## API Key Setup

1. **Google Places API:**
   - Visit: https://console.cloud.google.com/
   - Enable Places API
   - Create API key

2. **WhoisXML API:**
   - Visit: https://whoisxmlapi.com/
   - Sign up and get API key

3. **Hunter.io API:**
   - Visit: https://hunter.io/
   - Sign up and get API key

## Support

For issues or questions, check the server logs for detailed error messages. All operations are logged with timestamps and context.
