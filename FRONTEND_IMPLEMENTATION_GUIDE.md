# Frontend Implementation Guide - No Website Finder

## Complete Frontend Implementation Documentation

---

## 1. Settings Page Changes

### Update Settings Form Component

**File**: `src/pages/Settings.jsx` (or similar)

#### Add Facebook API Key Field

```jsx
// In your settings form, add this field after Foursquare:

<div className="form-group">
  <label htmlFor="facebook">
    Facebook Graph API Access Token
    <span className="optional-badge">Optional</span>
  </label>
  <input
    type="text"
    id="facebook"
    name="apiKeys.facebook"
    value={formData.apiKeys?.facebook || ''}
    onChange={handleChange}
    placeholder="EAABsb..."
    className="form-control"
  />
  <small className="form-text">
    Optional: Enriches no-website businesses with Facebook pages and owner info
    <a href="https://developers.facebook.com/docs/graph-api/get-started" target="_blank" rel="noopener">
      Get API Key
    </a>
  </small>
</div>
```

#### Remove Bing Maps Field

```jsx
// DELETE this entire field from your settings form:
// <div className="form-group">
//   <label htmlFor="bingMaps">Bing Maps API Key</label>
//   ...
// </div>
```

#### Complete API Keys Section

```jsx
const apiKeyFields = [
  {
    id: 'googlePlaces',
    label: 'Google Places API Key',
    required: true,
    placeholder: 'AIzaSy...',
    description: 'Required for business discovery (16-grid search)',
    helpLink: 'https://developers.google.com/maps/documentation/places/web-service/get-api-key'
  },
  {
    id: 'whoisfreaks',
    label: 'WhoisFreaks API Key',
    required: false,
    placeholder: 'e113e67b...',
    description: 'Free tier: 1000 queries/month (Priority #2 for domain age)',
    helpLink: 'https://whoisfreaks.com/'
  },
  {
    id: 'whoisxml',
    label: 'WhoisXML API Key',
    required: false,
    placeholder: 'at_...',
    description: 'Paid fallback for domain age (Priority #3)',
    helpLink: 'https://whoisxmlapi.com/'
  },
  {
    id: 'foursquare',
    label: 'Foursquare API Key',
    required: false,
    placeholder: 'fsq3...',
    description: 'Optional: ~5-10% additional businesses',
    helpLink: 'https://location.foursquare.com/developer/'
  },
  {
    id: 'facebook',
    label: 'Facebook Graph API Access Token',
    required: false,
    placeholder: 'EAABsb...',
    description: 'Optional: Enriches no-website businesses with Facebook data',
    helpLink: 'https://developers.facebook.com/docs/graph-api/get-started'
  },
  {
    id: 'hunter',
    label: 'Hunter.io API Key',
    required: false,
    placeholder: 'abc123...',
    description: 'Email finding (currently disabled)',
    helpLink: 'https://hunter.io/api'
  }
];

// Render fields
{apiKeyFields.map(field => (
  <div key={field.id} className="form-group">
    <label htmlFor={field.id}>
      {field.label}
      {field.required && <span className="required">*</span>}
      {!field.required && <span className="optional-badge">Optional</span>}
    </label>
    <input
      type="text"
      id={field.id}
      name={`apiKeys.${field.id}`}
      value={formData.apiKeys?.[field.id] || ''}
      onChange={handleChange}
      placeholder={field.placeholder}
      required={field.required}
      className="form-control"
    />
    <small className="form-text">
      {field.description}
      {field.helpLink && (
        <a href={field.helpLink} target="_blank" rel="noopener"> Get API Key</a>
      )}
    </small>
  </div>
))}
```

---

## 2. No Website Finder Page

### Create New Page Component

**File**: `src/pages/NoWebsiteFinder.jsx`

```jsx
import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const NoWebsiteFinder = () => {
  const [formData, setFormData] = useState({
    city: '',
    state: '',
    country: '',
    radius: 5000,
    niche: '',
    leads: 50
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [searchId, setSearchId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/no-website/scan',
        formData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setResults(response.data.data);
      setSearchId(response.data.data[0]?.searchId);
      alert(`Found ${response.data.count} businesses without websites!`);
    } catch (error) {
      alert(error.response?.data?.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      results.map(b => ({
        'Owner Name': b.ownerName || 'N/A',
        'Business Name': b.businessName,
        'Rating': b.rating || 'N/A',
        'Phone': b.phone || 'N/A',
        'Email': b.email || 'N/A',
        'Social Media': b.facebookPage || 'N/A',
        'Address': b.address,
        'City': b.city,
        'State': b.state || 'N/A',
        'Country': b.country,
        'Niche': b.niche || 'N/A'
      }))
    );
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'No Website Businesses');
    XLSX.writeFile(workbook, `no-website-${formData.city}-${Date.now()}.xlsx`);
  };

  return (
    <div className="no-website-finder">
      <h1>No Website Finder</h1>
      <p>Find businesses without websites and their social media pages (Facebook, Zomato, Instagram, etc.)</p>

      <form onSubmit={handleSubmit} className="search-form">
        <div className="form-row">
          <div className="form-group">
            <label>City *</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
              required
              placeholder="San Francisco"
            />
          </div>

          <div className="form-group">
            <label>State</label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({...formData, state: e.target.value})}
              placeholder="California"
            />
          </div>

          <div className="form-group">
            <label>Country *</label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({...formData, country: e.target.value})}
              required
              placeholder="United States"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Radius (meters)</label>
            <input
              type="number"
              value={formData.radius}
              onChange={(e) => setFormData({...formData, radius: parseInt(e.target.value)})}
              min="1000"
              max="50000"
            />
          </div>

          <div className="form-group">
            <label>Niche/Category</label>
            <input
              type="text"
              value={formData.niche}
              onChange={(e) => setFormData({...formData, niche: e.target.value})}
              placeholder="restaurants, salons, etc."
            />
          </div>

          <div className="form-group">
            <label>Lead Limit</label>
            <input
              type="number"
              value={formData.leads}
              onChange={(e) => setFormData({...formData, leads: parseInt(e.target.value)})}
              min="1"
              max="500"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Scanning...' : 'Find Businesses'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h2>Found {results.length} Businesses</h2>
            <button onClick={downloadExcel} className="btn-download">
              Download Excel
            </button>
          </div>

          <table className="results-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Owner Name</th>
                <th>Rating</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Social Media</th>
                <th>Address</th>
                <th>Niche</th>
              </tr>
            </thead>
            <tbody>
              {results.map((business, index) => (
                <tr key={index}>
                  <td>{business.businessName}</td>
                  <td>{business.ownerName || 'N/A'}</td>
                  <td>{business.rating ? `⭐ ${business.rating}` : 'N/A'}</td>
                  <td>{business.phone || 'N/A'}</td>
                  <td>{business.email || 'N/A'}</td>
                  <td>
                    {business.facebookPage ? (
                      <a href={business.facebookPage} target="_blank" rel="noopener">
                        View Page
                      </a>
                    ) : 'N/A'}
                  </td>
                  <td>{business.address}</td>
                  <td>{business.niche || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NoWebsiteFinder;
```

---

## 3. API Service Layer

### Create API Service

**File**: `src/services/noWebsiteApi.js`

```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const noWebsiteApi = {
  // Scan for businesses without websites
  scan: async (searchParams) => {
    const response = await axios.post(
      `${API_BASE_URL}/no-website/scan`,
      searchParams,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Get recent searches
  getRecentSearches: async (limit = 20) => {
    const response = await axios.get(
      `${API_BASE_URL}/no-website/searches/recent?limit=${limit}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Get results for specific search
  getSearchResults: async (searchId) => {
    const response = await axios.get(
      `${API_BASE_URL}/no-website/searches/${searchId}/results`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Delete search
  deleteSearch: async (searchId) => {
    const response = await axios.delete(
      `${API_BASE_URL}/no-website/searches/${searchId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  }
};
```

---

## 4. Router Configuration

### Add Route

**File**: `src/App.jsx` or `src/routes/index.jsx`

```jsx
import NoWebsiteFinder from './pages/NoWebsiteFinder';

// Add to your routes:
<Route path="/no-website" element={<NoWebsiteFinder />} />
```

### Add Navigation Link

**File**: `src/components/Navbar.jsx` or `src/components/Sidebar.jsx`

```jsx
<NavLink to="/no-website" className="nav-link">
  <i className="icon-search"></i>
  No Website Finder
</NavLink>
```

---

## 5. History/Recent Searches Component

### Create History Component

**File**: `src/components/NoWebsiteHistory.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { noWebsiteApi } from '../services/noWebsiteApi';
import * as XLSX from 'xlsx';

const NoWebsiteHistory = () => {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSearches();
  }, []);

  const loadSearches = async () => {
    try {
      const response = await noWebsiteApi.getRecentSearches(20);
      setSearches(response.data);
    } catch (error) {
      console.error('Failed to load searches:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = async (searchId, city) => {
    try {
      const response = await noWebsiteApi.getSearchResults(searchId);
      const results = response.data.results;

      const worksheet = XLSX.utils.json_to_sheet(
        results.map(b => ({
          'Owner Name': b.ownerName || 'N/A',
          'Business Name': b.businessName,
          'Phone': b.phone || 'N/A',
          'Email': b.email || 'N/A',
          'Facebook Page': b.facebookPage || 'N/A',
          'Address': b.address,
          'City': b.city,
          'State': b.state || 'N/A',
          'Country': b.country,
          'Niche': b.niche || 'N/A'
        }))
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Businesses');
      XLSX.writeFile(workbook, `no-website-${city}-${Date.now()}.xlsx`);
    } catch (error) {
      alert('Failed to download results');
    }
  };

  const deleteSearch = async (searchId) => {
    if (!window.confirm('Delete this search?')) return;
    
    try {
      await noWebsiteApi.deleteSearch(searchId);
      setSearches(searches.filter(s => s._id !== searchId));
    } catch (error) {
      alert('Failed to delete search');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="no-website-history">
      <h2>Recent Searches</h2>
      
      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Location</th>
            <th>Niche</th>
            <th>Results</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {searches.map(search => (
            <tr key={search._id}>
              <td>{new Date(search.createdAt).toLocaleDateString()}</td>
              <td>{search.city}, {search.state}, {search.country}</td>
              <td>{search.niche || 'All'}</td>
              <td>{search.resultsCount}</td>
              <td>
                <span className={`status-badge status-${search.status}`}>
                  {search.status}
                </span>
              </td>
              <td>
                <button 
                  onClick={() => downloadResults(search._id, search.city)}
                  className="btn-sm btn-download"
                >
                  Download
                </button>
                <button 
                  onClick={() => deleteSearch(search._id)}
                  className="btn-sm btn-delete"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NoWebsiteHistory;
```

---

## 6. Styling (Optional)

### Basic CSS

**File**: `src/styles/NoWebsiteFinder.css`

```css
.no-website-finder {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.search-form {
  background: #f8f9fa;
  padding: 30px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.btn-primary {
  background: #007bff;
  color: white;
  padding: 12px 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.results-table th,
.results-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.results-table th {
  background: #f8f9fa;
  font-weight: 600;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-completed {
  background: #d4edda;
  color: #155724;
}

.status-processing {
  background: #fff3cd;
  color: #856404;
}

.status-failed {
  background: #f8d7da;
  color: #721c24;
}
```

---

## 7. Environment Variables

### Update .env file

**File**: `.env`

```env
REACT_APP_API_URL=http://localhost:5000/api
```

For production:
```env
REACT_APP_API_URL=https://your-backend-domain.com/api
```

---

## 8. Implementation Checklist

### Settings Page:
- [ ] Add Facebook API key input field
- [ ] Remove Bing Maps API key field
- [ ] Update form validation
- [ ] Test save/load settings

### No Website Finder Page:
- [ ] Create NoWebsiteFinder component
- [ ] Add search form with all fields
- [ ] Implement scan functionality
- [ ] Display results in table
- [ ] Add Excel download button
- [ ] Add loading states

### API Integration:
- [ ] Create noWebsiteApi service
- [ ] Add authentication headers
- [ ] Handle error responses
- [ ] Test all endpoints

### Navigation:
- [ ] Add route to router
- [ ] Add navigation link in sidebar/navbar
- [ ] Test navigation flow

### History:
- [ ] Create history component
- [ ] Display recent searches
- [ ] Add download functionality
- [ ] Add delete functionality

---

## 9. Testing Guide

### Manual Testing Steps:

1. **Settings Page**:
   - Save Facebook API key
   - Verify it persists after refresh
   - Confirm Bing Maps field is removed

2. **No Website Finder**:
   - Fill form with valid data
   - Click "Find Businesses"
   - Verify results show businesses WITHOUT websites
   - Download Excel and verify format

3. **History**:
   - View recent searches
   - Download previous results
   - Delete a search

4. **Authorization**:
   - Logout and try to access page (should redirect to login)
   - Login and verify you only see your own searches

---

## 10. API Response Examples

### Scan Response:
```json
{
  "success": true,
  "message": "Found 15 businesses without websites",
  "count": 15,
  "data": [
    {
      "_id": "65abc123",
      "businessName": "Joe's Pizza",
      "ownerName": "John Doe",
      "phone": "+1-555-0123",
      "email": "contact@joespizza.com",
      "facebookPage": "https://facebook.com/joespizza",
      "address": "123 Main St, San Francisco, CA",
      "city": "San Francisco",
      "state": "California",
      "country": "United States",
      "niche": "restaurant"
    }
  ]
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Google Places API key not configured"
}
```

---

## Summary

This guide provides everything needed to implement the No Website Finder feature in your frontend:

1. **Settings Page**: Add Facebook field, remove Bing Maps
2. **New Page**: Complete No Website Finder component
3. **API Service**: All backend integration
4. **History**: View and manage past searches
5. **Styling**: Basic CSS for professional look

All components use the same patterns as your existing Legacy page for consistency.
