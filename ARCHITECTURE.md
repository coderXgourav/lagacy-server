# Legacy Website Finder - System Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN / CLIENT                          │
│                    (POST /api/scan request)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXPRESS.JS SERVER                          │
│                     (scanRoute.js)                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────┐
        │      AGENT PIPELINE ORCHESTRATION      │
        └────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   DISCOVERY  │    │  DOMAIN AGE  │    │   CONTACT    │
│    AGENT     │───▶│    AGENT     │───▶│    FINDER    │
│              │    │              │    │    AGENT     │
│  (Google     │    │  (WhoisXML   │    │  (Hunter.io) │
│   Places)    │    │     API)     │    │     API)     │
└──────────────┘    └──────────────┘    └──────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                    ┌──────────────┐
                    │    FILTER    │
                    │    AGENT     │
                    │ (Pre-2020)   │
                    └──────────────┘
                             │
                             ▼
                    ┌──────────────┐
                    │   MONGODB    │
                    │   STORAGE    │
                    └──────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXCEL EXPORT AGENT                           │
│                  (GET /api/download)                            │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

### 1. Scan Request Flow
```
Admin Input
    │
    ├─ location: "Kolkata, West Bengal, India"
    └─ businessCategory: "restaurants"
            │
            ▼
    Discovery Agent
            │
            ├─ Queries Google Places API
            ├─ Extracts business details
            └─ Returns: [{ name, address, phone, website, category }]
            │
            ▼
    Domain Age Agent
            │
            ├─ Extracts domain from website URL
            ├─ Queries WhoisXML API
            └─ Returns: [{ ...business, domain, creationDate }]
            │
            ▼
    Filter Agent
            │
            ├─ Checks if creationDate < Jan 1, 2020
            └─ Returns: [{ ...business, isLegacy: true }]
            │
            ▼
    Contact Finder Agent
            │
            ├─ Queries Hunter.io API
            └─ Returns: [{ ...business, emails: [...] }]
            │
            ▼
    MongoDB Storage
            │
            └─ Saves Business documents
```

### 2. Download Request Flow
```
GET /api/download
        │
        ▼
Query MongoDB
        │
        ├─ Find all { isLegacy: true }
        └─ Sort by scannedAt (newest first)
        │
        ▼
Excel Exporter Agent
        │
        ├─ Creates workbook
        ├─ Adds headers & styling
        ├─ Populates rows
        └─ Generates buffer
        │
        ▼
Response (Excel file)
```

## 📦 Module Dependencies

```
app.js
  │
  ├─ conf/database.js (MongoDB connection)
  │
  └─ src/routes/
      │
      ├─ scanRoute.js
      │   │
      │   ├─ agents/discoveryAgent.js
      │   │   └─ axios → Google Places API
      │   │
      │   ├─ agents/domainAgeAgent.js
      │   │   └─ axios → WhoisXML API
      │   │
      │   ├─ agents/filterAgent.js
      │   │   └─ Date filtering logic
      │   │
      │   ├─ agents/contactFinderAgent.js
      │   │   └─ axios → Hunter.io API
      │   │
      │   ├─ models/Business.js
      │   │   └─ mongoose schema
      │   │
      │   └─ utils/logger.js
      │
      └─ downloadRoute.js
          │
          ├─ models/Business.js
          │   └─ mongoose queries
          │
          ├─ agents/excelExporter.js
          │   └─ exceljs
          │
          └─ utils/logger.js
```

## 🔐 External API Integration

### Google Places API
```
Endpoint: https://maps.googleapis.com/maps/api/place/textsearch/json
Method: GET
Params: { query, key }
Response: { results: [{ place_id, name, ... }] }

Endpoint: https://maps.googleapis.com/maps/api/place/details/json
Method: GET
Params: { place_id, fields, key }
Response: { result: { name, website, phone, ... } }
```

### WhoisXML API
```
Endpoint: https://www.whoisxmlapi.com/whoisserver/WhoisService
Method: GET
Params: { apiKey, domainName, outputFormat }
Response: { WhoisRecord: { createdDate, ... } }
```

### Hunter.io API
```
Endpoint: https://api.hunter.io/v2/domain-search
Method: GET
Params: { domain, api_key }
Response: { data: { emails: [{ value, type, ... }] } }
```

## 💾 Database Schema

```
Collection: businesses
{
  _id: ObjectId,
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
  scannedAt: Date,
  __v: Number
}

Indexes:
- _id (default)
- isLegacy (for filtering)
- scannedAt (for sorting)
```

## ⚡ Performance Considerations

### Rate Limiting Strategy
```
Discovery Agent:     No delay (single request per scan)
Domain Age Agent:    500ms delay between requests
Contact Finder:      1000ms delay between requests
```

### Retry Logic
```
All API calls:
  - Initial attempt
  - Retry 1 (after 1s delay)
  - Retry 2 (after 1s delay)
  - Fail gracefully
```

### Error Handling
```
Try-Catch at multiple levels:
  1. Route level (scanRoute.js)
  2. Agent level (each agent)
  3. API call level (axios requests)

Logging at each stage:
  - INFO: Operation start
  - SUCCESS: Operation complete
  - ERROR: Operation failed
```

## 🎯 Scalability Considerations

### Current Implementation
- Sequential processing (one business at a time)
- Suitable for: 10-50 businesses per scan
- Processing time: ~1-2 minutes per 10 businesses

### Future Enhancements
1. **Parallel Processing**: Use Promise.all() for concurrent API calls
2. **Queue System**: Implement BullMQ for background jobs
3. **Caching**: Cache domain age results to avoid duplicate lookups
4. **Pagination**: Add pagination to /api/download for large datasets
5. **WebSocket**: Real-time progress updates to admin dashboard

## 🔒 Security Best Practices

✅ API keys stored in .env (not in code)
✅ Input validation on location parameter
✅ Rate limiting to prevent API abuse
✅ Error messages don't expose sensitive data
✅ MongoDB connection uses environment variable
✅ CORS enabled for cross-origin requests

## 📊 Monitoring & Logging

All operations logged with:
- Timestamp
- Log level (INFO, SUCCESS, ERROR)
- Context data
- Error details (when applicable)

Example log output:
```
[INFO] 2024-01-15T10:30:00.000Z - Starting business discovery { location: 'Mumbai, India', businessCategory: 'hotels' }
[SUCCESS] 2024-01-15T10:30:05.000Z - Found 15 businesses with websites
[INFO] 2024-01-15T10:30:05.000Z - Checking domain age for 15 businesses
[SUCCESS] 2024-01-15T10:30:25.000Z - Enriched 12 businesses with domain age
[SUCCESS] 2024-01-15T10:30:25.000Z - Found 8 legacy websites (created before Jan 1, 2020)
```

## 🧪 Testing Strategy

1. **Unit Tests**: Test individual agents
2. **Integration Tests**: Test full pipeline
3. **API Tests**: Test endpoints with various inputs
4. **Load Tests**: Test with large datasets

Use provided test script:
```bash
node testLegacyFinder.js
```
