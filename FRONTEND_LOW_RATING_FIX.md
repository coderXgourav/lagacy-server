# Low Rating Business Finder - Frontend Debugging & Fix Guide

## 🔴 Problem
Search results are not showing up in both new search and recent search pages after backend scan completes successfully.

---

## 🔍 Step 1: Check Browser Console

Open your browser DevTools (F12) and check:

1. **Console Tab** - Look for JavaScript errors
2. **Network Tab** - Check the API response

### What to Look For in Network Tab:

**Request**: `POST http://localhost:5000/api/low-rating/scan`

**Expected Response** (Status 200):
```json
{
  "success": true,
  "message": "Found 115 businesses with ratings ≤ 5",
  "count": 115,
  "searchId": "673f8a1b2c3d4e5f6a7b8c9d",
  "data": [
    {
      "_id": "...",
      "businessName": "The Grove - Yerba Buena",
      "name": "The Grove - Yerba Buena",
      "rating": 4.4,
      "totalReviews": 1234,
      "phone": "+1-555-0123",
      "email": null,
      "website": "https://example.com",
      "address": "123 Main St, San Francisco, CA",
      "city": "San Francisco",
      "state": "California",
      "country": "United States",
      "niche": "restaurant"
    }
  ]
}
```

---

## 🛠️ Step 2: Debug Frontend Code

### Check 1: Verify Response Data Structure

Add console.log to see what you're receiving:

```javascript
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
    
    // DEBUG: Log the entire response
    console.log('Full response:', response);
    console.log('Response data:', response.data);
    console.log('Businesses array:', response.data.data);
    console.log('Count:', response.data.count);
    
    setResults(response.data.data);
    alert(`Found ${response.data.count} businesses with low ratings!`);
  } catch (error) {
    console.error('Error:', error);
    alert(error.response?.data?.message || 'Scan failed');
  } finally {
    setLoading(false);
  }
};
```

### Check 2: Verify State Update

Add console.log after setting results:

```javascript
setResults(response.data.data);
console.log('Results state updated:', response.data.data);
```

### Check 3: Verify Render Condition

Check if the results are rendering:

```javascript
console.log('Results length:', results.length);
console.log('Should render table:', results.length > 0);

{results.length > 0 && (
  <div className="results-section">
    <p>DEBUG: Rendering {results.length} results</p>
    {/* rest of your table */}
  </div>
)}
```

---

## 🔧 Step 3: Common Frontend Issues & Fixes

### Issue 1: Results Array is Undefined

**Problem**: `response.data.data` is undefined

**Fix**: Check the exact response structure
```javascript
// Try different paths:
setResults(response.data.data);           // Current
setResults(response.data.businesses);     // Alternative 1
setResults(response.data);                // Alternative 2
```

### Issue 2: Results Not Updating State

**Problem**: State not updating after API call

**Fix**: Ensure you're using the correct state setter
```javascript
const [results, setResults] = useState([]);

// Make sure this line exists and is correct
setResults(response.data.data || []);
```

### Issue 3: Conditional Rendering Not Working

**Problem**: `results.length > 0` is false even with data

**Fix**: Check if results is actually an array
```javascript
{Array.isArray(results) && results.length > 0 && (
  <div className="results-section">
    {/* table */}
  </div>
)}
```

### Issue 4: Field Names Don't Match

**Problem**: `business.businessName` is undefined

**Fix**: Use optional chaining or check both field names
```javascript
<td>{business.businessName || business.name || 'N/A'}</td>
<td>{business.rating || 'N/A'}</td>
<td>{business.totalReviews || 0}</td>
```

---

## 📋 Step 4: Complete Working Component

Here's a fully debugged version with all fixes:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const LowRatingFinder = () => {
  const [formData, setFormData] = useState({
    city: '',
    state: '',
    country: '',
    radius: 5000,
    niche: '',
    maxRating: 5.0,  // Changed to 5.0 for testing
    leads: 200
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  // DEBUG: Log results whenever they change
  useEffect(() => {
    console.log('Results updated:', results);
    console.log('Results length:', results.length);
  }, [results]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      console.log('Sending request with:', formData);
      
      const response = await axios.post(
        'http://localhost:5000/api/low-rating/scan',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Response received:', response.data);
      console.log('Businesses count:', response.data.count);
      console.log('Businesses array:', response.data.data);
      
      // Ensure we're setting an array
      const businessesArray = response.data.data || [];
      setResults(businessesArray);
      
      alert(`Found ${response.data.count || 0} businesses!`);
    } catch (error) {
      console.error('Scan error:', error);
      console.error('Error response:', error.response?.data);
      alert(error.response?.data?.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    if (!results || results.length === 0) {
      alert('No results to download');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      results.map(b => ({
        'Business Name': b.businessName || b.name || 'N/A',
        'Rating': b.rating || 'N/A',
        'Total Reviews': b.totalReviews || 0,
        'Phone': b.phone || 'N/A',
        'Email': b.email || 'N/A',
        'Website': b.website || 'N/A',
        'Address': b.address || 'N/A',
        'City': b.city || 'N/A',
        'State': b.state || 'N/A',
        'Country': b.country || 'N/A',
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
            placeholder="Max Rating (e.g., 5.0)"
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

      {/* DEBUG INFO */}
      <div style={{ padding: '10px', background: '#f0f0f0', margin: '10px 0' }}>
        <strong>Debug Info:</strong>
        <p>Results array length: {results?.length || 0}</p>
        <p>Is array: {Array.isArray(results) ? 'Yes' : 'No'}</p>
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
      </div>

      {/* RESULTS TABLE */}
      {Array.isArray(results) && results.length > 0 ? (
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
                <tr key={business._id || index}>
                  <td>{business.businessName || business.name || 'N/A'}</td>
                  <td>
                    <span className={`rating ${business.rating <= 2 ? 'critical' : 'warning'}`}>
                      ⭐ {business.rating || 'N/A'}
                    </span>
                  </td>
                  <td>{business.totalReviews || 0}</td>
                  <td>{business.phone || 'N/A'}</td>
                  <td>{business.email || 'N/A'}</td>
                  <td>
                    {business.website ? (
                      <a href={business.website} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    ) : 'N/A'}
                  </td>
                  <td>{business.address || 'N/A'}</td>
                  <td>{business.niche || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          {loading ? 'Loading...' : 'No results yet. Try searching with maxRating: 5.0'}
        </div>
      )}
    </div>
  );
};

export default LowRatingFinder;
```

---

## 🧪 Step 5: Test with These Values

Use these test values to ensure you get results:

```javascript
{
  city: "San Francisco",
  state: "California", 
  country: "United States",
  radius: 5000,
  niche: "",  // Leave empty
  maxRating: 5.0,  // Use 5.0 to get ALL businesses
  leads: 50
}
```

This should return ~115 businesses based on your backend logs.

---

## 📊 Step 6: Check Recent Searches Page

If recent searches aren't showing, check the API call:

```javascript
// In your Recent Searches component
useEffect(() => {
  const fetchSearches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        'http://localhost:5000/api/low-rating/searches/recent?limit=20',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Recent searches response:', response.data);
      
      // Backend returns both formats:
      const searches = response.data.searches || response.data.data || [];
      setSearches(searches);
    } catch (error) {
      console.error('Error fetching searches:', error);
    }
  };

  fetchSearches();
}, []);
```

---

## ✅ Verification Checklist

- [ ] Browser console shows no errors
- [ ] Network tab shows 200 response with data
- [ ] `response.data.data` is an array with items
- [ ] `results` state is updated with array
- [ ] `results.length > 0` evaluates to true
- [ ] Table renders with business data
- [ ] All fields display correctly (name, rating, phone, etc.)
- [ ] Download Excel button works
- [ ] Recent searches page shows past searches

---

## 🚨 If Still Not Working

1. **Share the console output** - Copy all console.log messages
2. **Share the Network response** - Copy the full API response from Network tab
3. **Share your component code** - The actual React component you're using

The backend is 100% working and returning data correctly. The issue is in how the frontend is handling the response.
