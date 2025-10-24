# Complete Frontend Integration Guide - Legacy Website Finder

## 🎯 Base URL
```
http://localhost:5000
```

---

## 📡 All API Endpoints

### 1. Health Check
```
GET /api/health
```

### 2. Start New Scan
```
POST /api/scan
```

### 3. Download Excel Report
```
GET /api/download
```

### 4. Get Search History
```
GET /api/history
```

### 5. Get Search Results by ID
```
GET /api/history/:searchId/businesses
```

### 6. Delete Search History
```
DELETE /api/history/:searchId
```

---

## 📋 Detailed API Specifications

### 1️⃣ Health Check

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

**Usage:**
```javascript
const checkHealth = async () => {
  const res = await fetch('http://localhost:5000/api/health');
  return await res.json();
};
```

---

### 2️⃣ Start New Scan

**Endpoint:** `POST /api/scan`

**Request Body:**
```json
{
  "city": "Mumbai",
  "state": "Maharashtra",
  "country": "India",
  "radius": 5000,
  "businessCategory": "restaurants",
  "leadCap": 25
}
```

**Field Details:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| city | string | ✅ Yes | - | City name |
| state | string | ❌ No | - | State/Province |
| country | string | ✅ Yes | - | Country name |
| radius | number | ❌ No | 5000 | Search radius (1000-50000 meters) |
| businessCategory | string | ❌ No | - | e.g., "restaurants", "hotels" |
| leadCap | number | ❌ No | 50 | Max results (1-100) |

**Success Response (200):**
```json
{
  "message": "Scan complete",
  "count": 15,
  "searchId": "507f1f77bcf86cd799439011",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
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

**Error Response (400):**
```json
{
  "error": "City and country are required"
}
```

**Error Response (500):**
```json
{
  "error": "Scan failed",
  "details": "Google Places API error: REQUEST_DENIED"
}
```

**Usage:**
```javascript
const startScan = async (formData) => {
  const res = await fetch('http://localhost:5000/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: formData.city,
      state: formData.state,
      country: formData.country,
      radius: formData.radius || 5000,
      businessCategory: formData.businessCategory,
      leadCap: formData.leadCap || 50
    })
  });
  return await res.json();
};
```

---

### 3️⃣ Download Excel Report

**Endpoint:** `GET /api/download`

**Response:** Binary Excel file (.xlsx)

**Headers:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename=legacy-websites.xlsx
```

**Error Response (404):**
```json
{
  "error": "No legacy websites found to export"
}
```

**Usage:**
```javascript
const downloadExcel = async () => {
  const res = await fetch('http://localhost:5000/api/download');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'legacy-websites.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
};
```

---

### 4️⃣ Get Search History

**Endpoint:** `GET /api/history`

**Response:**
```json
{
  "count": 10,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "city": "Mumbai",
      "state": "Maharashtra",
      "country": "India",
      "radius": 5000,
      "businessCategory": "restaurants",
      "leadCap": 25,
      "resultsCount": 15,
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439013",
      "city": "Delhi",
      "state": "",
      "country": "India",
      "radius": 10000,
      "businessCategory": "hotels",
      "leadCap": 30,
      "resultsCount": 8,
      "status": "completed",
      "createdAt": "2024-01-14T15:20:00.000Z"
    }
  ]
}
```

**Usage:**
```javascript
const getHistory = async () => {
  const res = await fetch('http://localhost:5000/api/history');
  const data = await res.json();
  return data.data; // Array of searches
};
```

---

### 5️⃣ Get Search Results by ID

**Endpoint:** `GET /api/history/:searchId/businesses`

**Response:**
```json
{
  "count": 15,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "businessName": "Heritage Restaurant",
      "category": "restaurant",
      "phone": "+91 22 1234 5678",
      "address": "123 Main St, Mumbai",
      "website": "https://heritage-restaurant.com",
      "domainCreationDate": "2015-03-15T00:00:00.000Z",
      "isLegacy": true,
      "emails": ["info@heritage-restaurant.com"],
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

**Error Response (404):**
```json
{
  "error": "Search not found"
}
```

**Usage:**
```javascript
const getSearchResults = async (searchId) => {
  const res = await fetch(`http://localhost:5000/api/history/${searchId}/businesses`);
  const data = await res.json();
  return data.data; // Array of businesses
};
```

---

### 6️⃣ Delete Search History

**Endpoint:** `DELETE /api/history/:searchId`

**Response:**
```json
{
  "message": "Search history deleted"
}
```

**Usage:**
```javascript
const deleteSearch = async (searchId) => {
  await fetch(`http://localhost:5000/api/history/${searchId}`, {
    method: 'DELETE'
  });
};
```

---

## 🎨 Complete React Implementation

### API Service (api.js)
```javascript
const API_BASE = 'http://localhost:5000';

export const api = {
  // Health check
  checkHealth: async () => {
    const res = await fetch(`${API_BASE}/api/health`);
    return await res.json();
  },

  // Start scan
  startScan: async (data) => {
    const res = await fetch(`${API_BASE}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return await res.json();
  },

  // Download Excel
  downloadExcel: async () => {
    const res = await fetch(`${API_BASE}/api/download`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'legacy-websites.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  },

  // Get history
  getHistory: async () => {
    const res = await fetch(`${API_BASE}/api/history`);
    const data = await res.json();
    return data.data;
  },

  // Get search results
  getSearchResults: async (searchId) => {
    const res = await fetch(`${API_BASE}/api/history/${searchId}/businesses`);
    const data = await res.json();
    return data.data;
  },

  // Delete search
  deleteSearch: async (searchId) => {
    await fetch(`${API_BASE}/api/history/${searchId}`, {
      method: 'DELETE'
    });
  }
};
```

---

### Scan Form Component
```jsx
import React, { useState } from 'react';
import { api } from './api';

const ScanForm = () => {
  const [form, setForm] = useState({
    city: '',
    state: '',
    country: '',
    radius: 5000,
    businessCategory: '',
    leadCap: 50
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.startScan(form);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="City *"
          value={form.city}
          onChange={(e) => setForm({...form, city: e.target.value})}
          required
        />
        <input
          placeholder="State (optional)"
          value={form.state}
          onChange={(e) => setForm({...form, state: e.target.value})}
        />
        <input
          placeholder="Country *"
          value={form.country}
          onChange={(e) => setForm({...form, country: e.target.value})}
          required
        />
        <input
          type="number"
          placeholder="Radius (meters)"
          value={form.radius}
          onChange={(e) => setForm({...form, radius: parseInt(e.target.value)})}
        />
        <input
          placeholder="Business Category"
          value={form.businessCategory}
          onChange={(e) => setForm({...form, businessCategory: e.target.value})}
        />
        <input
          type="number"
          placeholder="Lead Cap"
          value={form.leadCap}
          onChange={(e) => setForm({...form, leadCap: parseInt(e.target.value)})}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Scanning...' : 'Start Scan'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {results && (
        <div>
          <h3>Found {results.count} Legacy Websites</h3>
          <button onClick={api.downloadExcel}>Download Excel</button>
          {results.data.map((business) => (
            <div key={business._id}>
              <h4>{business.businessName}</h4>
              <p>Website: {business.website}</p>
              <p>Created: {new Date(business.domainCreationDate).toLocaleDateString()}</p>
              <p>Emails: {business.emails.join(', ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScanForm;
```

---

### Search History Component
```jsx
import React, { useState, useEffect } from 'react';
import { api } from './api';

const SearchHistory = () => {
  const [history, setHistory] = useState([]);
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getHistory();
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const viewResults = async (searchId) => {
    setLoading(true);
    try {
      const data = await api.getSearchResults(searchId);
      setBusinesses(data);
      setSelectedSearch(searchId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (searchId) => {
    if (confirm('Delete this search?')) {
      await api.deleteSearch(searchId);
      loadHistory();
      if (selectedSearch === searchId) {
        setSelectedSearch(null);
        setBusinesses([]);
      }
    }
  };

  return (
    <div>
      <h2>Search History</h2>
      {loading && <p>Loading...</p>}
      
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Location</th>
            <th>Category</th>
            <th>Results</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {history.map((search) => (
            <tr key={search._id}>
              <td>{new Date(search.createdAt).toLocaleString()}</td>
              <td>
                {search.city}
                {search.state && `, ${search.state}`}
                , {search.country}
              </td>
              <td>{search.businessCategory || 'All'}</td>
              <td>{search.resultsCount}</td>
              <td>
                <span className={`status-${search.status}`}>
                  {search.status}
                </span>
              </td>
              <td>
                <button onClick={() => viewResults(search._id)}>View</button>
                <button onClick={() => handleDelete(search._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedSearch && businesses.length > 0 && (
        <div>
          <h3>Results ({businesses.length})</h3>
          <button onClick={api.downloadExcel}>Download Excel</button>
          <table>
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Website</th>
                <th>Domain Age</th>
                <th>Emails</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <tr key={business._id}>
                  <td>{business.businessName}</td>
                  <td>
                    <a href={business.website} target="_blank" rel="noopener noreferrer">
                      {business.website}
                    </a>
                  </td>
                  <td>{new Date(business.domainCreationDate).toLocaleDateString()}</td>
                  <td>{business.emails.join(', ')}</td>
                  <td>{business.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SearchHistory;
```

---

## 📊 TypeScript Interfaces

```typescript
// Request Types
interface ScanRequest {
  city: string;
  state?: string;
  country: string;
  radius?: number;
  businessCategory?: string;
  leadCap?: number;
}

// Response Types
interface Business {
  _id: string;
  businessName: string;
  category: string;
  phone: string;
  address: string;
  website: string;
  domainCreationDate: string;
  isLegacy: boolean;
  emails: string[];
  location: {
    city: string;
    state: string;
    country: string;
  };
  scannedAt: string;
}

interface ScanResponse {
  message: string;
  count: number;
  searchId: string;
  data: Business[];
}

interface SearchHistory {
  _id: string;
  city: string;
  state?: string;
  country: string;
  radius: number;
  businessCategory?: string;
  leadCap: number;
  resultsCount: number;
  status: 'completed' | 'failed';
  createdAt: string;
}

interface HistoryResponse {
  count: number;
  data: SearchHistory[];
}

interface BusinessesResponse {
  count: number;
  data: Business[];
}
```

---

## 🧪 Testing Commands

```bash
# 1. Health check
curl http://localhost:5000/api/health

# 2. Start scan
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"city":"Mumbai","state":"Maharashtra","country":"India","radius":5000,"businessCategory":"restaurants","leadCap":10}'

# 3. Get history
curl http://localhost:5000/api/history

# 4. Get search results (replace SEARCH_ID)
curl http://localhost:5000/api/history/SEARCH_ID/businesses

# 5. Delete search (replace SEARCH_ID)
curl -X DELETE http://localhost:5000/api/history/SEARCH_ID

# 6. Download Excel
curl -O http://localhost:5000/api/download
```

---

## ⚡ Performance Notes

- **Scan time:** 1-2 minutes per 10 businesses
- **History load:** < 500ms
- **Search results:** < 1 second
- **Excel download:** < 2 seconds

---

## 🎯 Recommended UI Flow

1. **Dashboard Page**
   - Show scan form
   - Display recent scans (last 5)
   - Quick stats (total scans, total leads)

2. **New Scan Page**
   - Full scan form with all options
   - Real-time progress indicator
   - Results display after completion

3. **History Page**
   - Table of all past scans
   - Filter by date, location, status
   - View/delete actions

4. **Results Page**
   - Display businesses from selected search
   - Export to Excel button
   - Contact information display

---

## 🔒 Error Handling

```javascript
const handleApiError = (error) => {
  if (error.message.includes('required')) {
    return 'Please fill in all required fields';
  } else if (error.message.includes('API error')) {
    return 'Service temporarily unavailable';
  } else if (error.message.includes('not found')) {
    return 'Search not found';
  } else {
    return 'An error occurred. Please try again.';
  }
};
```

---

## ✅ Integration Checklist

- [ ] Create API service file
- [ ] Implement scan form component
- [ ] Implement history list component
- [ ] Implement results view component
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add form validation
- [ ] Test all endpoints
- [ ] Add Excel download
- [ ] Style components
- [ ] Add responsive design
- [ ] Test error scenarios

---

**All endpoints are ready! Start integrating with your frontend.** 🚀
