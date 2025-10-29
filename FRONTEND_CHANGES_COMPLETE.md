# Frontend Changes - Complete Guide

## All Changes Needed for No Website Finder

---

## 1. Settings Page

### Add Facebook API Key Field

**Location**: Settings page where you configure API keys

```jsx
// Add this field after Foursquare API key:

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
  />
  <small className="form-text">
    Optional: Enriches no-website businesses with Facebook pages and owner info
  </small>
</div>
```

### Remove Bing Maps Field

```jsx
// DELETE this entire field:
// <div className="form-group">
//   <label>Bing Maps API Key</label>
//   <input name="apiKeys.bingMaps" ... />
// </div>
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/no-website/scan',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setResults(response.data.data);
      alert(`Found ${response.data.count} businesses!`);
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
      <p>Find businesses without websites and their social media pages</p>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            type="text"
            placeholder="City *"
            value={formData.city}
            onChange={(e) => setFormData({...formData, city: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="State"
            value={formData.state}
            onChange={(e) => setFormData({...formData, state: e.target.value})}
          />
          <input
            type="text"
            placeholder="Country *"
            value={formData.country}
            onChange={(e) => setFormData({...formData, country: e.target.value})}
            required
          />
        </div>

        <div className="form-row">
          <input
            type="number"
            placeholder="Radius (meters)"
            value={formData.radius}
            onChange={(e) => setFormData({...formData, radius: parseInt(e.target.value)})}
            min="1000"
            max="50000"
          />
          <input
            type="text"
            placeholder="Niche/Category"
            value={formData.niche}
            onChange={(e) => setFormData({...formData, niche: e.target.value})}
          />
          <input
            type="number"
            placeholder="Lead Limit"
            value={formData.leads}
            onChange={(e) => setFormData({...formData, leads: parseInt(e.target.value)})}
            min="1"
            max="500"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Scanning...' : 'Find Businesses'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h2>Found {results.length} Businesses</h2>
            <button onClick={downloadExcel}>Download Excel</button>
          </div>

          <table>
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
                        View
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

## 3. Add Route

**File**: `src/App.jsx` or `src/routes/index.jsx`

```jsx
import NoWebsiteFinder from './pages/NoWebsiteFinder';

// Add route:
<Route path="/no-website" element={<NoWebsiteFinder />} />
```

---

## 4. Add Navigation Link

**File**: `src/components/Navbar.jsx` or `Sidebar.jsx`

```jsx
<NavLink to="/no-website">
  No Website Finder
</NavLink>
```

---

## 5. API Service (Optional but Recommended)

**File**: `src/services/noWebsiteApi.js`

```javascript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

export const noWebsiteApi = {
  scan: async (params) => {
    const response = await axios.post(
      `${API_URL}/no-website/scan`,
      params,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  getRecentSearches: async (limit = 20) => {
    const response = await axios.get(
      `${API_URL}/no-website/searches/recent?limit=${limit}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  getSearchResults: async (searchId) => {
    const response = await axios.get(
      `${API_URL}/no-website/searches/${searchId}/results`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  deleteSearch: async (searchId) => {
    const response = await axios.delete(
      `${API_URL}/no-website/searches/${searchId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  }
};
```

---

## 6. Basic Styling (Optional)

**File**: `src/styles/NoWebsiteFinder.css`

```css
.no-website-finder {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 15px;
}

.form-row input {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  background: #007bff;
  color: white;
  padding: 12px 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

th {
  background: #f8f9fa;
  font-weight: 600;
}
```

---

## Summary of Changes

### Settings Page:
- ✅ Add Facebook API key field
- ❌ Remove Bing Maps field

### New Page:
- ✅ Create NoWebsiteFinder component
- ✅ Search form (city, state, country, radius, niche, leads)
- ✅ Results table with 8 columns
- ✅ Excel download button

### Columns in Table:
1. Business Name
2. Owner Name
3. **Rating** ⭐ (NEW)
4. Phone
5. Email
6. **Social Media** (was "Facebook")
7. Address
8. Niche

### Excel Export Columns:
Same 8 columns + City, State, Country

### Key Features:
- ✅ JWT authentication
- ✅ Loading states
- ✅ Error handling
- ✅ Excel download
- ✅ Social media links
- ✅ Rating display with star emoji

---

## Testing Checklist

- [ ] Settings page shows Facebook field
- [ ] Settings page doesn't show Bing Maps field
- [ ] Can navigate to /no-website page
- [ ] Search form works
- [ ] Results display in table
- [ ] Rating column shows stars
- [ ] Social Media column shows links
- [ ] Excel download works
- [ ] Excel has all 10 columns
- [ ] Only see your own searches (JWT auth)

---

## API Endpoints Used

```
POST   /api/no-website/scan
GET    /api/no-website/searches/recent
GET    /api/no-website/searches/:searchId/results
DELETE /api/no-website/searches/:searchId
```

All require JWT token in Authorization header.

---

## Environment Variables

```env
REACT_APP_API_URL=http://localhost:5000/api
```

For production:
```env
REACT_APP_API_URL=https://your-backend.com/api
```

---

## Quick Start

1. Add Facebook field to Settings page
2. Remove Bing Maps field from Settings page
3. Create NoWebsiteFinder.jsx component
4. Add route to router
5. Add navigation link
6. Test the flow
7. Done! 🚀
