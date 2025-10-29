# Quick Frontend Changes - Social Media Detection

## 3 Simple Changes Needed

### Change 1: Update Table Header
**File**: `NoWebsiteFinder.jsx`

```jsx
// OLD:
<th>Facebook</th>

// NEW:
<th>Social Media</th>
```

---

### Change 2: Update Excel Export
**File**: `NoWebsiteFinder.jsx`

```javascript
// OLD:
'Facebook Page': b.facebookPage || 'N/A',

// NEW:
'Social Media': b.facebookPage || 'N/A',
```

---

### Change 3: Update Page Description
**File**: `NoWebsiteFinder.jsx`

```jsx
// OLD:
<p>Find businesses without websites and their Facebook pages</p>

// NEW:
<p>Find businesses without websites and their social media pages (Facebook, Zomato, Instagram, etc.)</p>
```

---

## Complete Updated Component Snippet

```jsx
return (
  <div className="no-website-finder">
    <h1>No Website Finder</h1>
    <p>Find businesses without websites and their social media pages (Facebook, Zomato, Instagram, etc.)</p>

    {/* ... form code ... */}

    <table className="results-table">
      <thead>
        <tr>
          <th>Business Name</th>
          <th>Owner Name</th>
          <th>Phone</th>
          <th>Email</th>
          <th>Social Media</th>  {/* ← CHANGED */}
          <th>Address</th>
          <th>Niche</th>
        </tr>
      </thead>
      {/* ... tbody ... */}
    </table>
  </div>
);

// Excel export:
const worksheet = XLSX.utils.json_to_sheet(
  results.map(b => ({
    'Owner Name': b.ownerName || 'N/A',
    'Business Name': b.businessName,
    'Phone': b.phone || 'N/A',
    'Email': b.email || 'N/A',
    'Social Media': b.facebookPage || 'N/A',  // ← CHANGED
    'Address': b.address,
    'City': b.city,
    'State': b.state || 'N/A',
    'Country': b.country,
    'Niche': b.niche || 'N/A'
  }))
);
```

---

## That's It!

These 3 changes make your frontend compatible with the new social media detection feature.

The backend already handles:
- ✅ Detecting social media URLs
- ✅ Including businesses with social media only
- ✅ Storing social media URLs in results
- ✅ Supporting Facebook, Zomato, Instagram, Yelp, etc.

You just need to update the UI labels! 🚀
