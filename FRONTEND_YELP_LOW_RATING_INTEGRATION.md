# Yelp Integration for Low Rating Page - Frontend Guide

## ✅ Integration Status

**GOOD NEWS**: Yelp integration is **already working** in the backend for the Low Rating page! Unlike the Legacy Business Finder, the Low Rating page doesn't need business websites, making Yelp perfect for this use case.

### What Yelp Provides for Low Rating Search:
- ✅ Business names, addresses, phone numbers
- ✅ **Star ratings** (1.0 - 5.0)
- ✅ **Review counts**
- ✅ Business categories
- ✅ Yelp page URLs
- ✅ Geographic coordinates

---

## 🔧 Frontend Changes Required

### 1. Add Yelp API Key to Settings Page

**File**: Your Settings page component

Add this field to your API keys section:

```jsx
{
  name: 'yelp',
  label: 'Yelp API Key',
  required: false,
  placeholder: 'Bearer token...',
  description: 'Optional: Adds low-rated businesses from Yelp to search results',
  helpLink: 'https://www.yelp.com/developers/v3/manage_app'
}
```

**Form data binding**:
```jsx
<input
  type="text"
  placeholder="Yelp API Key"
  value={formData.apiKeys.yelp || ''}
  onChange={(e) => setFormData({
    ...formData,
    apiKeys: {
      ...formData.apiKeys,
      yelp: e.target.value
    }
  })}
/>
```

### 2. Update Low Rating Results Display

**File**: Your LowRatingFinder component

Add source indicator and Yelp URL to results table:

```jsx
<table>
  <thead>
    <tr>
      <th>Business Name</th>
      <th>Rating</th>
      <th>Reviews</th>
      <th>Phone</th>
      <th>Website</th>
      <th>Yelp Page</th> {/* NEW COLUMN */}
      <th>Source</th>     {/* NEW COLUMN */}
      <th>Address</th>
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
        <td>
          {business.website ? (
            <a href={business.website} target="_blank" rel="noopener">
              View
            </a>
          ) : 'N/A'}
        </td>
        {/* NEW: Yelp Page Column */}
        <td>
          {business.yelpUrl ? (
            <a href={business.yelpUrl} target="_blank" rel="noopener">
              View Yelp
            </a>
          ) : 'N/A'}
        </td>
        {/* NEW: Source Column */}
        <td>
          <span className={`source-badge ${business.source}`}>
            {business.source === 'yelp' ? '🟡 Yelp' : '🔵 Google'}
          </span>
        </td>
        <td>{business.address}</td>
      </tr>
    ))}
  </tbody>
</table>
```

### 3. Add Source Styling

**File**: Your CSS file

```css
.source-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.source-badge.yelp {
  background: #fff3cd;
  color: #856404;
}

.source-badge.google {
  background: #d1ecf1;
  color: #0c5460;
}
```

### 4. Update Excel Export

**File**: Your LowRatingFinder component

Add Yelp URL and source to Excel export:

```jsx
const downloadExcel = () => {
  const worksheet = XLSX.utils.json_to_sheet(
    results.map(b => ({
      'Business Name': b.businessName,
      'Rating': b.rating,
      'Total Reviews': b.totalReviews,
      'Phone': b.phone || 'N/A',
      'Website': b.website || 'N/A',
      'Yelp Page': b.yelpUrl || 'N/A',        // NEW
      'Source': b.source || 'google',         // NEW
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
```

---

## 🎯 How It Works

### Backend Integration (Already Done):
1. **Parallel Search**: Backend searches both Google Places and Yelp simultaneously
2. **Deduplication**: Combines results and removes duplicates by name + address
3. **Rating Filter**: Only returns businesses with rating ≤ maxRating threshold
4. **Source Tracking**: Each business is tagged with its source ('google' or 'yelp')

### API Response Format:
```json
{
  "success": true,
  "count": 45,
  "data": [
    {
      "businessName": "Poor Service Restaurant",
      "rating": 2.1,
      "totalReviews": 87,
      "phone": "+1-555-0123",
      "website": "",
      "yelpUrl": "https://yelp.com/biz/poor-service-restaurant",
      "source": "yelp",
      "address": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "country": "United States"
    }
  ]
}
```

---

## 🧪 Testing Integration

### 1. Add Yelp API Key
1. Go to Settings page
2. Add your Yelp API key
3. Save settings

### 2. Test Low Rating Search
1. Go to Low Rating Finder page
2. Search for: City="San Francisco", Max Rating=3.0
3. Check results include both Google and Yelp businesses
4. Verify Yelp businesses have:
   - Yelp page URLs
   - Source = "yelp"
   - Ratings ≤ 3.0

### 3. Check Backend Logs
Should show:
```
[INFO] Searching Google Places for low-rated businesses...
[INFO] Searching Yelp for low-rated businesses...
[SUCCESS] Google: Found 25 businesses with rating ≤ 3.0
[SUCCESS] Yelp: Found 15 businesses with rating ≤ 3.0
[SUCCESS] Combined results: 35 unique businesses (Google: 25, Yelp: 15)
```

---

## 📊 Expected Results

### With Yelp Integration:
```
Google Places: ~20-40 low-rated businesses
Yelp:         ~10-25 additional low-rated businesses
Total:        ~30-65 businesses per search
```

### Business Sources:
- **Google Places**: Businesses with websites and ratings
- **Yelp**: Restaurants, services, retail with poor reviews
- **Combined**: More comprehensive coverage of poorly-rated businesses

---

## 🔑 Get Yelp API Key

### Steps:
1. Go to [Yelp Developers](https://www.yelp.com/developers/v3/manage_app)
2. Create a Yelp account
3. Create a new app
4. Copy the API Key (starts with Bearer token)
5. Add to Settings page

### API Limits:
- **Free Tier**: 5,000 API calls per day
- **Rate Limit**: 5,000 calls per day
- **Search Limit**: 50 businesses per request

---

## ✅ Verification Checklist

- [ ] Yelp API key field added to Settings page
- [ ] Field has proper label and placeholder
- [ ] Optional badge displayed
- [ ] Help text with link to Yelp Developers
- [ ] Form data binding works (`formData.apiKeys.yelp`)
- [ ] Save button updates settings
- [ ] API key persists after page refresh
- [ ] Low rating search includes Yelp results
- [ ] Results table shows Yelp page URLs
- [ ] Results table shows source badges
- [ ] Excel export includes Yelp data
- [ ] Backend logs show Yelp count

---

## 🎯 Summary

**What to Add:**
1. Yelp API key field in Settings page
2. Yelp Page column in results table
3. Source column with badges
4. Yelp data in Excel export
5. CSS styling for source badges

**What You Get:**
- 30-50% more low-rated businesses per search
- Better coverage of restaurants and services
- Yelp page URLs for direct outreach
- Source tracking (Google vs Yelp)

**Time to Implement:** 10-15 minutes

The backend is fully ready - just add these UI enhancements!