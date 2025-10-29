# Social Media Detection Feature

## Overview
Many businesses list their social media pages (Facebook, Zomato, Instagram, etc.) as their "website" in Google Maps instead of having a real website. This feature detects these cases and treats them as businesses without proper websites.

---

## How It Works

### 1. Detection Logic

When Google Places API returns a business with a "website" field, we check if it's actually a social media URL:

**Detected Social Media Domains:**
- facebook.com
- instagram.com
- twitter.com
- linkedin.com
- youtube.com
- zomato.com
- swiggy.com
- ubereats.com
- yelp.com
- tripadvisor.com

### 2. Business Classification

```javascript
// Example 1: No website at all
{
  name: "Joe's Pizza",
  website: null  // ✅ Included (no website)
}

// Example 2: Real website
{
  name: "Tech Corp",
  website: "https://techcorp.com"  // ❌ Excluded (has real website)
}

// Example 3: Social media as website
{
  name: "Local Cafe",
  website: "https://facebook.com/localcafe"  // ✅ Included (social media, not real website)
}

// Example 4: Zomato page as website
{
  name: "Spice Restaurant",
  website: "https://zomato.com/spice-restaurant"  // ✅ Included (food delivery platform, not real website)
}
```

### 3. Data Storage

The social media URL is stored in the `facebookPage` field (despite the name, it can store ANY social media URL):

```javascript
{
  businessName: "Local Cafe",
  facebookPage: "https://facebook.com/localcafe",  // From Google Places
  // OR
  facebookPage: "https://zomato.com/local-cafe",   // From Google Places
  // OR
  facebookPage: "https://facebook.com/localcafe",  // From Facebook API enrichment
}
```

---

## Priority Order for Social Media URLs

1. **Google Places social URL** (if it's Facebook)
2. **Facebook API result** (if Facebook API is configured)
3. **Google Places social URL** (any other platform like Zomato, Instagram)
4. **null** (if no social media found)

---

## Examples

### Example 1: Business with Zomato Page

**Google Places Response:**
```json
{
  "name": "Biryani House",
  "website": "https://www.zomato.com/bangalore/biryani-house",
  "formatted_phone_number": "+91-80-1234-5678"
}
```

**Our System:**
- ✅ Detects Zomato URL as social media (not real website)
- ✅ Includes business in results
- ✅ Stores Zomato URL in `facebookPage` field
- ✅ Attempts Facebook API enrichment (may find actual Facebook page)

**Final Result:**
```json
{
  "businessName": "Biryani House",
  "phone": "+91-80-1234-5678",
  "facebookPage": "https://www.zomato.com/bangalore/biryani-house",
  "email": null,
  "ownerName": null
}
```

### Example 2: Business with Facebook Page

**Google Places Response:**
```json
{
  "name": "Yoga Studio",
  "website": "https://facebook.com/yogastudio123",
  "formatted_phone_number": "+1-555-0123"
}
```

**Our System:**
- ✅ Detects Facebook URL as social media
- ✅ Includes business in results
- ✅ Uses Facebook URL from Google Places
- ✅ Skips Facebook API (already have Facebook page)

**Final Result:**
```json
{
  "businessName": "Yoga Studio",
  "phone": "+1-555-0123",
  "facebookPage": "https://facebook.com/yogastudio123",
  "email": null,
  "ownerName": null
}
```

### Example 3: Business with Instagram Only

**Google Places Response:**
```json
{
  "name": "Boutique Fashion",
  "website": "https://instagram.com/boutiquefashion",
  "formatted_phone_number": "+1-555-0456"
}
```

**Our System:**
- ✅ Detects Instagram URL as social media
- ✅ Includes business in results
- ✅ Stores Instagram URL
- ✅ Attempts Facebook API enrichment (may find Facebook page too)

**Final Result:**
```json
{
  "businessName": "Boutique Fashion",
  "phone": "+1-555-0456",
  "facebookPage": "https://instagram.com/boutiquefashion",
  "email": null,
  "ownerName": null
}
```

---

## Benefits

### 1. More Comprehensive Results
Captures businesses that technically have a "website" field in Google Maps but it's just a social media page.

### 2. Better Lead Quality
These businesses are perfect leads because:
- They have online presence (social media)
- They DON'T have a proper website
- They're actively managing their business online
- They might be interested in getting a real website

### 3. Automatic Social Media Discovery
No need for separate social media scraping - Google Places already has this data!

---

## Frontend Display

### Excel Export Columns:
```
Owner Name | Business Name | Phone | Email | Facebook/Social Page | Address | City | State | Country | Niche
```

### Table Display:
The "Facebook" column can show any social media URL:
- Facebook pages
- Instagram profiles
- Zomato listings
- Swiggy pages
- Yelp pages
- etc.

### Recommended Label Change:
Consider renaming "Facebook Page" to "Social Media" in the frontend for clarity:

```jsx
// Instead of:
<th>Facebook</th>

// Use:
<th>Social Media</th>

// Or:
<th>Online Presence</th>
```

---

## Code Implementation

### Detection Function:
```javascript
const socialMediaDomains = [
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'linkedin.com',
  'youtube.com',
  'zomato.com',
  'swiggy.com',
  'ubereats.com',
  'yelp.com',
  'tripadvisor.com'
];

const isSocialMedia = (url) => {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return socialMediaDomains.some(domain => urlLower.includes(domain));
};
```

### Business Classification:
```javascript
if (!details.website || isSocialMedia(details.website)) {
  // Include in results
  businesses.push({
    name: details.name,
    socialPage: isSocialMedia(details.website) ? details.website : null,
    // ... other fields
  });
}
```

---

## Statistics Example

**Sample Scan Results:**

```
Total businesses found: 50

Breakdown:
- No website at all: 30 (60%)
- Facebook page only: 12 (24%)
- Zomato page only: 5 (10%)
- Instagram only: 2 (4%)
- Yelp page only: 1 (2%)
```

---

## Testing

### Test Cases:

1. **Business with no website**
   - Expected: ✅ Included
   - Social Page: null

2. **Business with real website**
   - Expected: ❌ Excluded
   - Example: "https://mybusiness.com"

3. **Business with Facebook URL**
   - Expected: ✅ Included
   - Social Page: "https://facebook.com/..."

4. **Business with Zomato URL**
   - Expected: ✅ Included
   - Social Page: "https://zomato.com/..."

5. **Business with Instagram URL**
   - Expected: ✅ Included
   - Social Page: "https://instagram.com/..."

---

## Future Enhancements

### Potential Additions:
- TikTok pages
- Pinterest profiles
- WhatsApp Business links
- Telegram channels
- Google My Business URLs
- Apple Maps URLs

### Add to detection list:
```javascript
'tiktok.com',
'pinterest.com',
'wa.me',
't.me',
'business.google.com'
```

---

## Summary

This feature significantly improves lead quality by:
1. ✅ Detecting social media URLs disguised as websites
2. ✅ Including these businesses in "no website" results
3. ✅ Preserving social media URLs for outreach
4. ✅ Providing more comprehensive business data

Businesses with only social media presence are prime candidates for website development services!
