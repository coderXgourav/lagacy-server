# Quick Start Guide - Legacy Website Finder

## 🚀 Get Started in 3 Steps

### Step 1: Verify Environment Variables
Check your `.env` file has all required API keys:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/lagacy-agent
whoisxml=YOUR_WHOISXML_API_KEY
hunter=YOUR_HUNTER_API_KEY
googlePlaces=YOUR_GOOGLE_PLACES_API_KEY
```

### Step 2: Start the Server
```bash
npm start
```

You should see:
```
Server running on port 5000
MongoDB connected successfully
```

### Step 3: Test the API

**Option A: Using the test script**
```bash
node testLegacyFinder.js
```

**Option B: Using cURL**
```bash
# Scan for legacy websites
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"location": "Mumbai, India", "businessCategory": "restaurants"}'

# Download Excel report
curl -O http://localhost:5000/api/download
```

**Option C: Using Postman**
1. POST to `http://localhost:5000/api/scan`
2. Body (JSON):
   ```json
   {
     "location": "Delhi, India",
     "businessCategory": "hotels"
   }
   ```
3. GET `http://localhost:5000/api/download` to download Excel

## 📊 What Happens During a Scan?

1. ✅ Finds businesses in your location using Google Places
2. ✅ Checks when their website domain was registered
3. ✅ Filters only websites created before Jan 1, 2020
4. ✅ Finds contact emails for those businesses
5. ✅ Saves everything to MongoDB
6. ✅ Returns results + allows Excel export

## 🎯 Expected Results

After a successful scan, you'll get:
- List of legacy businesses with old websites
- Their contact information (phone, email)
- Domain registration dates
- Ability to download as Excel for outreach

## ⚠️ Important Notes

- **Rate Limits:** The scan includes delays to respect API rate limits
- **API Quotas:** Check your API provider quotas (Google, WhoisXML, Hunter.io)
- **Processing Time:** Expect 1-2 minutes per 10 businesses
- **MongoDB:** Must be running before starting the server

## 🔧 Troubleshooting

**Server won't start:**
- Check if MongoDB is running: `mongod --version`
- Verify port 5000 is not in use

**No results found:**
- Try a different location or category
- Check API keys are valid
- Review server logs for errors

**Excel download fails:**
- Run a scan first to populate the database
- Check GET /api/download endpoint is accessible

## 📝 Example Locations to Try

- "New York, NY, USA"
- "London, England, UK"
- "Mumbai, Maharashtra, India"
- "Toronto, Ontario, Canada"
- "Sydney, NSW, Australia"

## 📞 Need Help?

Check the full documentation in `LEGACY_FINDER_README.md`
