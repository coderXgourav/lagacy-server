# Legacy Website Finder - Frontend Integration Guide

## 🎯 Overview
This document provides complete API specifications for integrating the Legacy Website Finder backend with your frontend application.

**Base URL:** `http://localhost:5000`

---

## 📡 API Endpoints

### 1. Health Check
**Endpoint:** `GET /api/health`

**Purpose:** Verify server is running

**Request:** None

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

**Frontend Usage:**
```javascript
const checkHealth = async () => {
  const response = await fetch('http://localhost:5000/api/health');
  const data = await response.json();
  return data.status === 'OK';
};
```

---

### 2. Scan for Legacy Websites
**Endpoint:** `POST /api/scan`

**Purpose:** Discover businesses with legacy websites in a specific location

#### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `city` | string | ✅ Yes | - | City name (e.g., "Mumbai") |
| `state` | string | ❌ No | - | State/Province (e.g., "Maharashtra") |
| `country` | string | ✅ Yes | - | Country name (e.g., "India") |
| `radius` | number | ❌ No | 5000 | Search radius in meters (1000-50000) |
| `businessCategory` | string | ❌ No | - | Business type (e.g., "restaurants", "hotels", "lawyers") |
| `leadCap` | number | ❌ No | 50 | Maximum leads to return (1-100) |

#### Request Example
```json
{
  "city": "Mumbai",
  "state": "Maharashtra",
  "country": "India",
  "radius": 10000,
  "businessCategory": "restaurants",
  "leadCap": 25
}
```

#### Response Success (200)
```json
{
  "message": "Scan complete",
  "count": 15,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "businessName": "Heritage Restaurant",
      "category": "restaurant",
      "phone": "+91 22 1234 5678",
      "address": "123 Main St, Mumbai, Maharashtra, India",
      "website": "https://heritage-restaurant.com",
      "domainCreationDate": "2015-03-15T00:00:00.000Z",
      "isLegacy": true,
      "emails": ["info@heritage-restaurant.com", "contact@heritage-restaurant.com"],
      "location": {
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India"
      },
      "scannedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### Response Error (400)
```json
{
  "error": "City and country are required"
}
```

#### Response Error (500)
```json
{
  "error": "Scan failed",
  "details": "Google Places API error: REQUEST_DENIED"
}
```

#### Frontend Usage
```javascript
const scanForLeads = async (formData) => {
  try {
    const response = await fetch('http://localhost:5000/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        city: formData.city,
        state: formData.state,
        country: formData.country,
        radius: formData.radius || 5000,
        businessCategory: formData.businessCategory,
        leadCap: formData.leadCap || 50
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Scan failed');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Scan error:', error);
    throw error;
  }
};
```

---

### 3. Download Excel Report
**Endpoint:** `GET /api/download`

**Purpose:** Export all legacy websites to Excel file

**Request:** None

**Response:** Binary file (Excel .xlsx)

**Response Headers:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename=legacy-websites.xlsx
```

#### Response Error (404)
```json
{
  "error": "No legacy websites found to export"
}
```

#### Frontend Usage
```javascript
const downloadExcel = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/download');
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Download failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'legacy-websites.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
};
```

---

## 🎨 Frontend Implementation Examples

### React Component Example

```jsx
import React, { useState } from 'react';

const LegacyScanner = () => {
  const [formData, setFormData] = useState({
    city: '',
    state: '',
    country: '',
    radius: 5000,
    businessCategory: '',
    leadCap: 50
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/download');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'legacy-websites.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Download failed');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="City"
          value={formData.city}
          onChange={(e) => setFormData({...formData, city: e.target.value})}
          required
        />
        <input
          type="text"
          placeholder="State (optional)"
          value={formData.state}
          onChange={(e) => setFormData({...formData, state: e.target.value})}
        />
        <input
          type="text"
          placeholder="Country"
          value={formData.country}
          onChange={(e) => setFormData({...formData, country: e.target.value})}
          required
        />
        <input
          type="number"
          placeholder="Radius (meters)"
          value={formData.radius}
          onChange={(e) => setFormData({...formData, radius: parseInt(e.target.value)})}
        />
        <input
          type="text"
          placeholder="Business Category"
          value={formData.businessCategory}
          onChange={(e) => setFormData({...formData, businessCategory: e.target.value})}
        />
        <input
          type="number"
          placeholder="Lead Cap"
          value={formData.leadCap}
          onChange={(e) => setFormData({...formData, leadCap: parseInt(e.target.value)})}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Scanning...' : 'Start Scan'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {results && (
        <div>
          <h3>Found {results.count} Legacy Websites</h3>
          <button onClick={handleDownload}>Download Excel</button>
          <ul>
            {results.data.map((business) => (
              <li key={business._id}>
                <h4>{business.businessName}</h4>
                <p>Website: {business.website}</p>
                <p>Created: {new Date(business.domainCreationDate).toLocaleDateString()}</p>
                <p>Emails: {business.emails.join(', ')}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LegacyScanner;
```

---

### Vue.js Component Example

```vue
<template>
  <div class="legacy-scanner">
    <form @submit.prevent="handleScan">
      <input v-model="form.city" placeholder="City" required />
      <input v-model="form.state" placeholder="State (optional)" />
      <input v-model="form.country" placeholder="Country" required />
      <input v-model.number="form.radius" type="number" placeholder="Radius" />
      <input v-model="form.businessCategory" placeholder="Business Category" />
      <input v-model.number="form.leadCap" type="number" placeholder="Lead Cap" />
      <button type="submit" :disabled="loading">
        {{ loading ? 'Scanning...' : 'Start Scan' }}
      </button>
    </form>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="results">
      <h3>Found {{ results.count }} Legacy Websites</h3>
      <button @click="downloadExcel">Download Excel</button>
      <div v-for="business in results.data" :key="business._id">
        <h4>{{ business.businessName }}</h4>
        <p>{{ business.website }}</p>
        <p>Emails: {{ business.emails.join(', ') }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      form: {
        city: '',
        state: '',
        country: '',
        radius: 5000,
        businessCategory: '',
        leadCap: 50
      },
      results: null,
      loading: false,
      error: null
    };
  },
  methods: {
    async handleScan() {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch('http://localhost:5000/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.form)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error);
        }

        this.results = await response.json();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
    async downloadExcel() {
      try {
        const response = await fetch('http://localhost:5000/api/download');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'legacy-websites.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        this.error = 'Download failed';
      }
    }
  }
};
</script>
```

---

## 🔄 Workflow & User Experience

### Recommended UI Flow

1. **Input Form**
   - City (required, text input)
   - State (optional, text input)
   - Country (required, text input or dropdown)
   - Radius (optional, slider 1000-50000m, default 5000)
   - Business Category (optional, text input or dropdown)
   - Lead Cap (optional, number input 1-100, default 50)

2. **Scan Button**
   - Show loading spinner during scan
   - Display progress message: "Scanning for legacy websites..."
   - Estimated time: 1-2 minutes per 10 businesses

3. **Results Display**
   - Show count: "Found X legacy websites"
   - Display table/cards with:
     - Business Name
     - Website URL
     - Domain Age
     - Contact Emails
     - Phone Number
     - Address
   - Add "Download Excel" button

4. **Error Handling**
   - Show user-friendly error messages
   - Suggest fixes (e.g., "Check your internet connection")

---

## 📊 Data Models

### Business Object Structure
```typescript
interface Business {
  _id: string;
  businessName: string;
  category: string;
  phone: string;
  address: string;
  website: string;
  domainCreationDate: string; // ISO 8601 date
  isLegacy: boolean;
  emails: string[];
  location: {
    city: string;
    state: string;
    country: string;
  };
  scannedAt: string; // ISO 8601 date
}
```

### Scan Request Structure
```typescript
interface ScanRequest {
  city: string;
  state?: string;
  country: string;
  radius?: number; // 1000-50000
  businessCategory?: string;
  leadCap?: number; // 1-100
}
```

### Scan Response Structure
```typescript
interface ScanResponse {
  message: string;
  count: number;
  data: Business[];
}
```

---

## ⚡ Performance Considerations

### Expected Response Times
- **Health Check:** < 100ms
- **Scan (10 businesses):** 1-2 minutes
- **Scan (50 businesses):** 5-8 minutes
- **Download Excel:** < 2 seconds

### Rate Limiting
- No rate limiting on backend
- Implement frontend debouncing for scan button
- Show warning if leadCap > 50 (longer processing time)

### Loading States
```javascript
// Recommended loading messages
const loadingMessages = [
  'Discovering businesses...',
  'Checking domain ages...',
  'Filtering legacy websites...',
  'Finding contact emails...',
  'Saving results...'
];

// Rotate messages every 15 seconds during scan
```

---

## 🚨 Error Handling

### Common Errors & Solutions

| Error | Cause | Frontend Action |
|-------|-------|-----------------|
| "City and country are required" | Missing required fields | Show validation error |
| "Google Places API error: REQUEST_DENIED" | API key issue | Show "Service temporarily unavailable" |
| "No businesses found" | No results in area | Suggest broader search radius |
| "No legacy websites found" | All websites are new | Show message, suggest different location |
| Network error | Server down | Show "Cannot connect to server" |

### Error Handling Example
```javascript
const handleError = (error) => {
  if (error.message.includes('required')) {
    return 'Please fill in all required fields';
  } else if (error.message.includes('API error')) {
    return 'Service temporarily unavailable. Please try again later.';
  } else if (error.message.includes('No businesses found')) {
    return 'No businesses found. Try increasing the search radius.';
  } else {
    return 'An error occurred. Please try again.';
  }
};
```

---

## 🎨 UI/UX Recommendations

### Form Validation
```javascript
const validateForm = (formData) => {
  const errors = {};
  
  if (!formData.city) errors.city = 'City is required';
  if (!formData.country) errors.country = 'Country is required';
  if (formData.radius < 1000 || formData.radius > 50000) {
    errors.radius = 'Radius must be between 1000 and 50000 meters';
  }
  if (formData.leadCap < 1 || formData.leadCap > 100) {
    errors.leadCap = 'Lead cap must be between 1 and 100';
  }
  
  return errors;
};
```

### Business Category Suggestions
```javascript
const categories = [
  'restaurants',
  'hotels',
  'lawyers',
  'dentists',
  'auto repair',
  'real estate',
  'insurance',
  'accounting',
  'plumbing',
  'electricians'
];
```

### Radius Presets
```javascript
const radiusPresets = [
  { label: '1 km', value: 1000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 }
];
```

---

## 🔒 Security Considerations

### CORS
Backend has CORS enabled. No additional configuration needed.

### API Key Protection
API keys are stored on backend. Frontend doesn't need to handle them.

### Input Sanitization
Backend validates all inputs. Frontend should still validate for UX.

---

## 🧪 Testing

### Test Endpoints
```javascript
// Test 1: Health check
fetch('http://localhost:5000/api/health')
  .then(r => r.json())
  .then(console.log);

// Test 2: Small scan
fetch('http://localhost:5000/api/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    city: 'Mumbai',
    country: 'India',
    leadCap: 5
  })
}).then(r => r.json()).then(console.log);

// Test 3: Download
fetch('http://localhost:5000/api/download')
  .then(r => r.blob())
  .then(blob => console.log('File size:', blob.size));
```

---

## 📞 Support

**Backend Server:** `http://localhost:5000`
**Documentation:** See `LEGACY_FINDER_README.md`
**API Testing:** Use Postman collection `Legacy_Finder_Postman_Collection.json`

---

## ✅ Integration Checklist

- [ ] Set up API base URL constant
- [ ] Implement scan form with all fields
- [ ] Add form validation
- [ ] Show loading state during scan
- [ ] Display results in table/cards
- [ ] Implement Excel download
- [ ] Add error handling
- [ ] Test with various inputs
- [ ] Add loading progress indicators
- [ ] Implement responsive design
