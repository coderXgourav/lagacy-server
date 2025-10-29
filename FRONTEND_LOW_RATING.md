# Low Rating Business Finder - Frontend Implementation Guide

## Overview
Create a new page to find businesses with low ratings (poor reviews) for reputation management outreach.

---

## 1. Create Page Component

**File**: `src/pages/LowRatingFinder.jsx`

```jsx
import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const LowRatingFinder = () => {
  const [formData, setFormData] = useState({
    city: '',
    state: '',
    country: '',
    radius: 5000,
    niche: '',
    maxRating: 3.0,
    leads: 200
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/low-rating/scan',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setResults(response.data.data);
      alert(`Found ${response.data.count} businesses with low ratings!`);
    } catch (error) {
      alert(error.response?.data?.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      results.map(b => ({
        'Business Name': b.businessName,
        'Rating': b.rating,
        'Total Reviews': b.totalReviews,
        'Phone': b.phone || 'N/A',
        'Email': b.email || 'N/A',
        'Website': b.website || 'N/A',
        'Address': b.address,
        'City': b.city,
        'State': b.state || 'N/A',
        'Country': b.country,
        'Niche': b.niche || 'N/A'
      }))
    );
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Low Rating Businesses');
    XLSX.writeFile(workbook, `low-rating-${formData.city}-${Date.now()}.xlsx`);
  };

  return (
    <div className="low-rating-finder">
      <h1>Low Rating Business Finder</h1>
      <p>Find businesses with poor ratings for reputation management outreach</p>

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
            step="0.1"
            placeholder="Max Rating (e.g., 3.0)"
            value={formData.maxRating}
            onChange={(e) => setFormData({...formData, maxRating: parseFloat(e.target.value)})}
            min="1.0"
            max="5.0"
          />
          <input
            type="number"
            placeholder="Lead Limit"
            value={formData.leads}
            onChange={(e) => setFormData({...formData, leads: parseInt(e.target.value)})}
            min="1"
            max="200"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Scanning...' : 'Find Low Rating Businesses'}
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
                <th>Rating</th>
                <th>Reviews</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Website</th>
                <th>Address</th>
                <th>Niche</th>
              </tr>
            </thead>
            <tbody>
              {results.map((business, index) => (
                <tr key={index}>
                  <td>{business.businessName}</td>
                  <td>
                    <span className={`rating ${business.rating <= 2 ? 'critical' : 'warning'}`}>
                      ⭐ {business.rating}
                    </span>
                  </td>
                  <td>{business.totalReviews}</td>
                  <td>{business.phone || 'N/A'}</td>
                  <td>{business.email || 'N/A'}</td>
                  <td>
                    {business.website ? (
                      <a href={business.website} target="_blank" rel="noopener">
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

export default LowRatingFinder;
```

---

## 2. Add Route

**File**: `src/App.jsx` or `src/routes/index.jsx`

```jsx
import LowRatingFinder from './pages/LowRatingFinder';

// Add route:
<Route path="/low-rating" element={<LowRatingFinder />} />
```

---

## 3. Add Navigation Link

**File**: `src/components/Navbar.jsx` or `Sidebar.jsx`

```jsx
<NavLink to="/low-rating">
  Low Rating Finder
</NavLink>
```

---

## 4. Optional: API Service

**File**: `src/services/lowRatingApi.js`

```javascript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

export const lowRatingApi = {
  scan: async (params) => {
    const response = await axios.post(
      `${API_URL}/low-rating/scan`,
      params,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  getRecentSearches: async (limit = 20) => {
    const response = await axios.get(
      `${API_URL}/low-rating/searches/recent?limit=${limit}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  getSearchResults: async (searchId) => {
    const response = await axios.get(
      `${API_URL}/low-rating/searches/${searchId}/results`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  deleteSearch: async (searchId) => {
    const response = await axios.delete(
      `${API_URL}/low-rating/searches/${searchId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  }
};
```

---

## 5. Styling (Optional)

**File**: `src/styles/LowRatingFinder.css`

```css
.low-rating-finder {
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

.rating.critical {
  color: #dc3545;
  font-weight: bold;
}

.rating.warning {
  color: #ffc107;
  font-weight: bold;
}
```

---

## Summary

### What to Create:
1. ✅ **LowRatingFinder.jsx** - Main page component
2. ✅ **Add route** - `/low-rating`
3. ✅ **Add navigation link** - In sidebar/navbar
4. ✅ **Optional API service** - For cleaner code
5. ✅ **Optional styling** - CSS file

### Form Fields:
- City (required)
- State (optional)
- Country (required)
- Radius (default: 5000m)
- Niche/Category (optional)
- **Max Rating** (default: 3.0) - NEW FIELD
- Lead Limit (default: 200)

### Table Columns:
1. Business Name
2. **Rating** (with color coding: red ≤2, yellow ≤3)
3. **Total Reviews** (NEW)
4. Phone
5. Email
6. Website
7. Address
8. Niche

### Key Differences from No Website Finder:
- Has **Max Rating** input field (1.0-5.0)
- Shows **Rating** and **Total Reviews** columns
- Color-coded ratings (critical/warning)
- Different API endpoint: `/api/low-rating/scan`

The backend is ready - just create the frontend page!
