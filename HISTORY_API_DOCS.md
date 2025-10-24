# Search History API Documentation

## Overview
Track and view all scan history with results count and status.

---

## Endpoints

### 1. Get All Search History
**Endpoint:** `GET /api/history`

**Purpose:** Retrieve all past scans (last 50)

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
    }
  ]
}
```

**Frontend Usage:**
```javascript
const getSearchHistory = async () => {
  const response = await fetch('http://localhost:5000/api/history');
  const data = await response.json();
  return data.data; // Array of search history
};
```

---

### 2. Get Businesses from Specific Search
**Endpoint:** `GET /api/history/:searchId/businesses`

**Purpose:** Get all businesses found in a specific search

**Response:**
```json
{
  "count": 15,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "businessName": "Heritage Restaurant",
      "website": "https://heritage-restaurant.com",
      "emails": ["info@heritage-restaurant.com"],
      "domainCreationDate": "2015-03-15T00:00:00.000Z",
      "isLegacy": true,
      "location": {
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India"
      }
    }
  ]
}
```

**Frontend Usage:**
```javascript
const getSearchResults = async (searchId) => {
  const response = await fetch(`http://localhost:5000/api/history/${searchId}/businesses`);
  const data = await response.json();
  return data.data;
};
```

---

### 3. Delete Search History
**Endpoint:** `DELETE /api/history/:searchId`

**Purpose:** Remove a search from history

**Response:**
```json
{
  "message": "Search history deleted"
}
```

**Frontend Usage:**
```javascript
const deleteSearch = async (searchId) => {
  await fetch(`http://localhost:5000/api/history/${searchId}`, {
    method: 'DELETE'
  });
};
```

---

## Updated Scan Response

The `/api/scan` endpoint now returns a `searchId`:

```json
{
  "message": "Scan complete",
  "count": 15,
  "searchId": "507f1f77bcf86cd799439011",
  "data": [...]
}
```

Use this `searchId` to retrieve results later.

---

## React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const SearchHistory = () => {
  const [history, setHistory] = useState([]);
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [businesses, setBusinesses] = useState([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const response = await fetch('http://localhost:5000/api/history');
    const data = await response.json();
    setHistory(data.data);
  };

  const viewResults = async (searchId) => {
    const response = await fetch(`http://localhost:5000/api/history/${searchId}/businesses`);
    const data = await response.json();
    setBusinesses(data.data);
    setSelectedSearch(searchId);
  };

  const deleteSearch = async (searchId) => {
    await fetch(`http://localhost:5000/api/history/${searchId}`, {
      method: 'DELETE'
    });
    loadHistory();
  };

  return (
    <div>
      <h2>Search History</h2>
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
              <td>{search.city}, {search.state}, {search.country}</td>
              <td>{search.businessCategory || 'All'}</td>
              <td>{search.resultsCount}</td>
              <td>{search.status}</td>
              <td>
                <button onClick={() => viewResults(search._id)}>View</button>
                <button onClick={() => deleteSearch(search._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedSearch && (
        <div>
          <h3>Results ({businesses.length})</h3>
          {businesses.map((business) => (
            <div key={business._id}>
              <h4>{business.businessName}</h4>
              <p>{business.website}</p>
              <p>Emails: {business.emails.join(', ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchHistory;
```

---

## Data Model

```typescript
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
```

---

## Test Commands

```bash
# Get all history
curl http://localhost:5000/api/history

# Get specific search results
curl http://localhost:5000/api/history/SEARCH_ID/businesses

# Delete search
curl -X DELETE http://localhost:5000/api/history/SEARCH_ID
```
