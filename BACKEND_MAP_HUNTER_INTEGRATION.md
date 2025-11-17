# Backend Integration Complete: Map Coordinates & Hunter.io Toggle

## 🎯 Overview
Successfully implemented backend support for:
1. **Map-based location selection** - Accept lat/lng coordinates from frontend map
2. **Hunter.io toggle** - Enable/disable email enrichment per search
3. **Fixed radius** - All searches now use 5000m (5km) radius as specified

## ✅ Changes Implemented

### 1. Low Rating Module
#### Files Updated:
- ✅ `controllers/lowRatingController.js`
- ✅ `services/lowRatingGoogleService.optimized.js`
- ✅ `services/yelpLowRatingService.js`
- ✅ `models/LowRatingSearch.js`

#### Changes:
- **Controller**: Accept `lat`, `lng`, `useHunter` parameters
- **Validation**: Require either coordinates OR city/country
- **Geocoding**: Fallback to geocoding if coordinates not provided
- **Hunter Toggle**: Only enrich with Hunter.io when `useHunter = true`
- **Model**: Added `coordinates {lat, lng}` and `useHunter` fields
- **Services**: Accept lat/lng for direct coordinate-based searches

### 2. No Website Module
#### Files Updated:
- ✅ `controllers/noWebsiteController.js`
- ✅ `services/noWebsiteGoogleService.js`
- ✅ `models/NoWebsiteSearch.js`

#### Changes:
- **Controller**: Accept `lat`, `lng`, `useHunter` parameters
- **Validation**: Require either coordinates OR city/country
- **Geocoding**: Fallback to geocoding if coordinates not provided
- **Hunter Toggle**: Only enrich with Hunter.io when `useHunter = true`
- **Model**: Added `coordinates {lat, lng}` and `useHunter` fields
- **Service**: Accept lat/lng for direct coordinate-based searches

### 3. Legacy Finder Module
#### Files Updated:
- ✅ `controllers/searchExecutionController.js`
- ✅ `models/Search.js`

#### Changes:
- **Controller**: Accept `lat`, `lng`, `useHunter` parameters
- **Validation**: Require either coordinates OR city/state/country
- **Model**: Added `coordinates {lat, lng}` and `useHunter` to filters
- **Parameters**: Pass coordinates and useHunter to async search execution

## 📋 API Changes

### All Three Endpoints Now Accept:

```javascript
// POST /api/low-rating/scan
// POST /api/no-website/scan
// POST /api/searches/execute

{
  // OPTION 1: Map-based search (coordinates from map click)
  "lat": 37.7749,
  "lng": -122.4194,
  
  // OPTION 2: Traditional text-based search
  "city": "San Francisco",
  "state": "CA",
  "country": "USA",
  
  // Common fields
  "radius": 5000,        // Fixed at 5000m (5km)
  "category": "plumber", // or "niche" for no-website
  "leads": 50,
  "useHunter": true      // Toggle Hunter.io enrichment
}
```

### Validation Rules:
- ✅ Must provide either `(lat, lng)` OR `(city, country)`
- ✅ `radius` is fixed at 5000 (ignored from frontend, always 5km)
- ✅ `useHunter` defaults to `true` if not provided
- ✅ `category`/`niche` and `leads` still required

## 🔄 Behavior Changes

### Coordinate Priority:
1. **If lat/lng provided**: Use coordinates directly, skip geocoding
2. **If no coordinates**: Geocode city/state/country to get coordinates
3. **If geocoding fails**: Search fails with error

### Hunter.io Enrichment:
- **When useHunter = true**: Calls Hunter.io API for email enrichment
- **When useHunter = false**: Skips Hunter.io completely (saves API credits)
- **Default**: true (maintains backward compatibility)

### Radius Handling:
- **Fixed at 5000m** as per frontend requirements
- Frontend can send any value, backend overrides it to 5000
- Ensures consistency across all searches

## 🗄️ Database Schema Updates

### LowRatingSearch
```javascript
{
  coordinates: {
    lat: Number,
    lng: Number
  },
  useHunter: { type: Boolean, default: true }
}
```

### NoWebsiteSearch
```javascript
{
  coordinates: {
    lat: Number,
    lng: Number
  },
  useHunter: { type: Boolean, default: true }
}
```

### Search (Legacy Finder)
```javascript
{
  filters: {
    coordinates: {
      lat: Number,
      lng: Number
    },
    useHunter: { type: Boolean, default: true }
  }
}
```

## 🧪 Testing Checklist

### Test Scenarios:

#### ✅ Low Rating Module
- [ ] Test with map coordinates (lat/lng provided)
- [ ] Test with city/country (traditional search)
- [ ] Test with useHunter = true (should enrich)
- [ ] Test with useHunter = false (should skip Hunter)
- [ ] Test geocoding fallback
- [ ] Test validation (missing both coords and city)

#### ✅ No Website Module
- [ ] Test with map coordinates (lat/lng provided)
- [ ] Test with city/country (traditional search)
- [ ] Test with useHunter = true (should enrich)
- [ ] Test with useHunter = false (should skip Hunter)
- [ ] Test geocoding fallback
- [ ] Test validation (missing both coords and city)

#### ✅ Legacy Finder Module
- [ ] Test with map coordinates (lat/lng provided)
- [ ] Test with city/state/country (traditional search)
- [ ] Test with useHunter = true (should enrich)
- [ ] Test with useHunter = false (should skip Hunter)
- [ ] Test validation (missing both coords and city/state/country)

## 📝 Example Requests

### Low Rating Search (Map Coordinates)
```bash
POST http://localhost:5000/api/low-rating/scan
Content-Type: application/json

{
  "lat": 37.7749,
  "lng": -122.4194,
  "maxRating": 3.5,
  "leads": 50,
  "useHunter": true
}
```

### No Website Search (Traditional)
```bash
POST http://localhost:5000/api/no-website/scan
Content-Type: application/json

{
  "city": "San Francisco",
  "state": "CA",
  "country": "USA",
  "niche": "restaurant",
  "leads": 100,
  "useHunter": false
}
```

### Legacy Finder (Map Coordinates)
```bash
POST http://localhost:5000/api/searches/execute
Content-Type: application/json

{
  "lat": 40.7128,
  "lng": -74.0060,
  "category": "dentist",
  "useHunter": true
}
```

## 🔧 Backward Compatibility

### ✅ All changes are backward compatible:
1. **Old requests still work**: Clients sending only city/country will continue to function
2. **useHunter defaults to true**: Existing behavior maintained if not specified
3. **No breaking changes**: All existing fields remain functional

### Migration Notes:
- No database migration needed (new fields are optional)
- Frontend can gradually adopt map selection
- Hunter toggle can be rolled out independently

## 🚀 Next Steps

1. **Frontend Integration**: Update frontend to send lat/lng when map location selected
2. **Testing**: Thoroughly test all three modules with both coordinate modes
3. **Documentation**: Update API documentation with new parameters
4. **Monitoring**: Monitor Hunter.io API usage with toggle feature
5. **User Feedback**: Collect feedback on map selection UX

## 💡 Benefits

### Performance:
- ✅ Skip geocoding when coordinates provided (saves API call + latency)
- ✅ More precise searches with exact coordinates

### Cost Savings:
- ✅ Hunter.io toggle lets users control API credit usage
- ✅ Can disable Hunter for exploratory searches

### User Experience:
- ✅ Visual map selection more intuitive than typing addresses
- ✅ Exact location control improves result relevance
- ✅ Toggle gives users fine-grained control

---

**Status**: ✅ Backend implementation complete and ready for frontend integration
**Date**: 2024
**Author**: GitHub Copilot
