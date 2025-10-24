# Updated API Documentation

## POST /api/scan

### New Request Format

```json
{
  "city": "Mumbai",
  "state": "Maharashtra",
  "country": "India",
  "radius": 5000,
  "businessCategory": "restaurants",
  "leadCap": 20
}
```

### Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| city | String | ✅ Yes | - | City name |
| state | String | ❌ No | - | State/Province (optional) |
| country | String | ✅ Yes | - | Country name |
| radius | Number | ❌ No | 5000 | Search radius in meters |
| businessCategory | String | ❌ No | - | Business type filter |
| leadCap | Number | ❌ No | 50 | Maximum leads per scan |

### Examples

**With State:**
```json
{
  "city": "Kolkata",
  "state": "West Bengal",
  "country": "India",
  "radius": 10000,
  "businessCategory": "hotels",
  "leadCap": 30
}
```

**Without State:**
```json
{
  "city": "Dubai",
  "country": "UAE",
  "radius": 15000,
  "businessCategory": "restaurants",
  "leadCap": 25
}
```

**Minimal Request:**
```json
{
  "city": "London",
  "country": "UK"
}
```
(Uses defaults: radius=5000, leadCap=50)

### Response

```json
{
  "message": "Scan complete",
  "count": 15,
  "data": [
    {
      "businessName": "Example Restaurant",
      "category": "restaurant",
      "phone": "+91 1234567890",
      "address": "123 Street, Mumbai",
      "website": "https://example.com",
      "domainCreationDate": "2015-03-15",
      "isLegacy": true,
      "emails": ["info@example.com"],
      "location": {
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India"
      }
    }
  ]
}
```

## Test Commands

### PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/scan" -Method POST -ContentType "application/json" -Body '{"city":"Mumbai","state":"Maharashtra","country":"India","radius":5000,"businessCategory":"restaurants","leadCap":10}'
```

### Node.js Test:
```bash
node quick-test.js
```

### Postman:
Import `Legacy_Finder_Postman_Collection.json`
