# Google Places API Setup Guide

## 🚨 Error: REQUEST_DENIED

This error means Google Places API is not enabled or the API key is invalid.

---

## ✅ **Solution 1: Enable Google Places API (5 minutes)**

### Step 1: Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### Step 2: Create/Select Project
- Click project dropdown at top
- Create new project or select existing one

### Step 3: Enable Places API
1. Go to **APIs & Services** → **Library**
2. Search: "**Places API**"
3. Click on "**Places API**"
4. Click **ENABLE** button
5. Also search and enable "**Places API (New)**"

### Step 4: Create API Key
1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **API Key**
3. Copy the API key

### Step 5: Update .env File
```env
googlePlaces=AIzaSyC_YOUR_ACTUAL_API_KEY_HERE
```

### Step 6: Restart Server
```bash
npm start
```

### Step 7: Test Again
```bash
node quick-test.js
```

---

## ✅ **Solution 2: Use Mock Data (Instant)**

Test the system without Google API:

### Step 1: Enable Mock Mode
Add to `.env`:
```env
USE_MOCK_DATA=true
```

### Step 2: Restart Server
```bash
npm start
```

### Step 3: Test
```bash
node quick-test.js
```

You'll see: "Using MOCK data for testing" in logs.

---

## 🔍 **Verify API Key is Working**

Test your API key directly:
```bash
curl "https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurants+in+Mumbai&key=YOUR_API_KEY"
```

**Expected:** JSON response with `status: "OK"`

**If you get REQUEST_DENIED:**
- API key is invalid
- Places API not enabled
- Billing not enabled (Google requires billing account)

---

## 💳 **Important: Google Cloud Billing**

Google Places API requires a billing account, but offers:
- **$200 free credit per month**
- First 1000 requests free
- After that: ~$17 per 1000 requests

### Enable Billing:
1. Go to: https://console.cloud.google.com/billing
2. Link a billing account
3. You won't be charged unless you exceed free tier

---

## 🧪 **Quick Test Commands**

### With Real API:
```bash
# Remove or comment out in .env
# USE_MOCK_DATA=true

npm start
node quick-test.js
```

### With Mock Data:
```bash
# Add to .env
USE_MOCK_DATA=true

npm start
node quick-test.js
```

---

## 📋 **Checklist**

- [ ] Google Cloud project created
- [ ] Places API enabled
- [ ] API key created
- [ ] Billing account linked (required by Google)
- [ ] API key added to .env
- [ ] Server restarted
- [ ] Test successful

---

## 🆘 **Still Not Working?**

### Check API Key Format:
```env
# ✅ Correct
googlePlaces=AIzaSyC1234567890abcdefghijklmnopqrstuv

# ❌ Wrong (has spaces)
googlePlaces= AIzaSyC1234567890abcdefghijklmnopqrstuv

# ❌ Wrong (has quotes)
googlePlaces="AIzaSyC1234567890abcdefghijklmnopqrstuv"
```

### Check .env is Loaded:
Add to `src/routes/scanRoute.js` temporarily:
```javascript
console.log('API Key:', process.env.googlePlaces);
```

### Use Mock Data Instead:
```env
USE_MOCK_DATA=true
```

This lets you test the entire system without Google API!
