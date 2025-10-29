# No Website Finder - API Testing Guide

## Quick Test Flow

### 1. Login/Signup First
```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}

# Response: Copy the "token" value
```

### 2. Scan for Businesses Without Websites
```bash
POST http://localhost:5000/api/no-website/scan
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "city": "San Francisco",
  "state": "California",
  "country": "United States",
  "radius": 5000,
  "niche": "restaurants",
  "leads": 20
}

# Response: Returns array of businesses WITHOUT websites
# Each business includes: name, phone, address, Facebook page (if found)
```

### 3. Get Recent Searches
```bash
GET http://localhost:5000/api/no-website/searches/recent?limit=10
Authorization: Bearer YOUR_JWT_TOKEN

# Response: List of your recent searches with metadata
```

### 4. Get Results for Specific Search
```bash
GET http://localhost:5000/api/no-website/searches/{searchId}/results
Authorization: Bearer YOUR_JWT_TOKEN

# Response: All businesses found in that search
```

### 5. Delete a Search
```bash
DELETE http://localhost:5000/api/no-website/searches/{searchId}
Authorization: Bearer YOUR_JWT_TOKEN

# Response: Confirmation message
```

---

## Expected Response Format

### Scan Response:
```json
{
  "success": true,
  "message": "Found 15 businesses without websites",
  "count": 15,
  "data": [
    {
      "_id": "65abc123...",
      "searchId": "65abc000...",
      "userId": "65aaa111...",
      "ownerName": "John Doe",
      "businessName": "Joe's Pizza",
      "phone": "+1-555-0123",
      "email": "contact@joespizza.com",
      "facebookPage": "https://facebook.com/joespizza",
      "address": "123 Main St, San Francisco, CA 94102",
      "city": "San Francisco",
      "state": "California",
      "country": "United States",
      "niche": "restaurant",
      "location": {
        "lat": 37.7749,
        "lng": -122.4194
      },
      "scannedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## Key Features

### 16-Grid Search Algorithm
- Same strategy as Legacy page
- Divides search area into 16 overlapping grids
- Inner ring: 9 points at 40% offset
- Outer ring: 7 points at 70% offset
- Each grid searches 45% of total radius
- Deduplicates by place_id across all grids

### Filtering
- **ONLY** includes businesses WITHOUT websites
- Deduplicates by phone number
- Respects lead limit (stops when limit reached)

### Facebook Enrichment
- Attempts to find Facebook page for each business
- Extracts owner name, email, Facebook URL
- Continues even if Facebook lookup fails

---

## Environment Variables Required

```env
# Required
GOOGLE_PLACES_API_KEY=your_google_api_key

# Optional (for Facebook enrichment)
FACEBOOK_ACCESS_TOKEN=your_facebook_token

# Already configured
JWT_SECRET=your_jwt_secret
MONGODB_URI=mongodb://localhost:27017/lagacy-agent
```

---

## Testing Checklist

- [ ] User can scan for businesses without websites
- [ ] Results only include businesses WITHOUT websites
- [ ] 16-grid search finds more businesses than single search
- [ ] Facebook enrichment adds owner/email data (if API key configured)
- [ ] User can only see their own searches (authorization)
- [ ] Lead limit is respected
- [ ] Deduplication works (no duplicate businesses)
- [ ] User can delete their searches
- [ ] Recent searches list shows correct metadata
