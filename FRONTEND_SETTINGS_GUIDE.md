# Frontend Settings Page - API Keys Configuration

## API Keys to Display in Settings Page

### 1. Google Places API Key (Required)
- **Field Name**: `apiKeys.googlePlaces`
- **Label**: "Google Places API Key"
- **Required**: Yes
- **Description**: "Required for business discovery using 16-grid search strategy"
- **Used For**: 
  - Legacy page: Finding businesses WITH websites
  - No Website page: Finding businesses WITHOUT websites

### 2. WhoisFreaks API Key (Recommended)
- **Field Name**: `apiKeys.whoisfreaks`
- **Label**: "WhoisFreaks API Key"
- **Required**: No
- **Description**: "Free tier: 1000 queries/month for domain age lookup (Priority #2)"
- **Used For**: Domain age verification (fallback after RDAP)

### 3. WhoisXML API Key (Optional)
- **Field Name**: `apiKeys.whoisxml`
- **Label**: "WhoisXML API Key"
- **Required**: No
- **Description**: "Paid fallback for domain age when RDAP and WhoisFreaks fail (Priority #3)"
- **Used For**: Domain age verification (last resort)

### 4. Foursquare API Key (Optional)
- **Field Name**: `apiKeys.foursquare`
- **Label**: "Foursquare API Key"
- **Required**: No
- **Description**: "Optional: Provides ~5-10% additional businesses with websites"
- **Used For**: Supplementary business discovery on Legacy page

### 5. Facebook API Key (Optional - NEW)
- **Field Name**: `apiKeys.facebook`
- **Label**: "Facebook Graph API Access Token"
- **Required**: No
- **Description**: "Optional: Enriches no-website businesses with Facebook pages and owner info"
- **Used For**: Finding Facebook pages for businesses without websites

### 6. Hunter.io API Key (Optional - Disabled)
- **Field Name**: `apiKeys.hunter`
- **Label**: "Hunter.io API Key"
- **Required**: No
- **Description**: "Email finding (currently disabled to conserve credits)"
- **Used For**: Email discovery (feature disabled)

---

## API Keys REMOVED
- ~~Bing Maps API Key~~ - Removed from backend

---

## Settings Form Structure

```javascript
const apiKeyFields = [
  {
    name: 'googlePlaces',
    label: 'Google Places API Key',
    required: true,
    placeholder: 'AIzaSy...',
    description: 'Required for business discovery (16-grid search)',
    helpLink: 'https://developers.google.com/maps/documentation/places/web-service/get-api-key'
  },
  {
    name: 'whoisfreaks',
    label: 'WhoisFreaks API Key',
    required: false,
    placeholder: 'e113e67b...',
    description: 'Free tier: 1000 queries/month (Priority #2 for domain age)',
    helpLink: 'https://whoisfreaks.com/'
  },
  {
    name: 'whoisxml',
    label: 'WhoisXML API Key',
    required: false,
    placeholder: 'at_...',
    description: 'Paid fallback for domain age (Priority #3)',
    helpLink: 'https://whoisxmlapi.com/'
  },
  {
    name: 'foursquare',
    label: 'Foursquare API Key',
    required: false,
    placeholder: 'fsq3...',
    description: 'Optional: ~5-10% additional businesses',
    helpLink: 'https://location.foursquare.com/developer/'
  },
  {
    name: 'facebook',
    label: 'Facebook Graph API Access Token',
    required: false,
    placeholder: 'EAABsb...',
    description: 'Optional: Enriches no-website businesses with Facebook data',
    helpLink: 'https://developers.facebook.com/docs/graph-api/get-started'
  },
  {
    name: 'hunter',
    label: 'Hunter.io API Key',
    required: false,
    placeholder: 'abc123...',
    description: 'Email finding (currently disabled)',
    helpLink: 'https://hunter.io/api'
  }
];
```

---

## Priority Information Section (Optional)

Add an informational section to help users understand API usage:

### Domain Age Lookup Priority:
1. **RDAP API** - Free, no key required (Priority #1)
2. **WhoisFreaks** - Free tier: 1000/month (Priority #2)
3. **WhoisXML** - Paid fallback (Priority #3)

### Business Discovery:
- **Google Places**: 16-grid search strategy (primary source for both Legacy and No Website pages)
- **Foursquare**: Supplementary results (Legacy page only)
- **Facebook**: Enrichment for businesses without websites (No Website page only)

---

## Form Validation

```javascript
const validateSettings = (values) => {
  const errors = {};
  
  // Google Places is required
  if (!values.apiKeys?.googlePlaces) {
    errors.googlePlaces = 'Google Places API Key is required';
  }
  
  return errors;
};
```

---

## API Endpoint

**PUT /api/settings**

Request body:
```json
{
  "apiKeys": {
    "googlePlaces": "AIzaSy...",
    "whoisfreaks": "e113e67b...",
    "whoisxml": "at_...",
    "foursquare": "fsq3...",
    "facebook": "EAABsb...",
    "hunter": "abc123..."
  }
}
```

---

## Summary of Changes

### Added:
- ✅ Facebook API Key field (for No Website feature)

### Removed:
- ❌ Bing Maps API Key (removed from backend)

### Unchanged:
- Google Places API Key
- WhoisFreaks API Key
- WhoisXML API Key
- Foursquare API Key
- Hunter.io API Key
