# Legacy Website Finder - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Environment Setup
- [ ] MongoDB installed and running
- [ ] Node.js v14+ installed
- [ ] All dependencies installed (`npm install`)
- [ ] .env file configured with valid API keys

### 2. API Keys Verification
- [ ] Google Places API key is valid
  - Test: https://console.cloud.google.com/
  - Ensure Places API is enabled
  - Check quota limits
  
- [ ] WhoisXML API key is valid
  - Test: https://whoisxmlapi.com/dashboard
  - Check remaining credits
  
- [ ] Hunter.io API key is valid
  - Test: https://hunter.io/api-keys
  - Check monthly request limit

### 3. Database Configuration
- [ ] MongoDB URI is correct in .env
- [ ] Database connection successful
- [ ] Business collection can be created
- [ ] Test query: `db.businesses.find({})`

### 4. File Structure Verification
```
✅ src/agents/discoveryAgent.js
✅ src/agents/domainAgeAgent.js
✅ src/agents/filterAgent.js
✅ src/agents/contactFinderAgent.js
✅ src/agents/excelExporter.js
✅ src/models/Business.js
✅ src/routes/scanRoute.js
✅ src/routes/downloadRoute.js
✅ src/utils/logger.js
✅ app.js (updated)
```

## 🧪 Testing Checklist

### 1. Server Health Check
```bash
# Start server
npm start

# Test health endpoint
curl http://localhost:5000/api/health
```
Expected: `{"status":"OK","message":"Server is running"}`

### 2. Scan Endpoint Test
```bash
# Test with small location
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"location": "Mumbai, India", "businessCategory": "restaurants"}'
```
Expected: JSON response with count and data array

### 3. Download Endpoint Test
```bash
# After successful scan
curl -O http://localhost:5000/api/download
```
Expected: legacy-websites.xlsx file downloaded

### 4. Error Handling Test
```bash
# Test without location
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `{"error":"Location is required"}`

### 5. Run Test Script
```bash
node testLegacyFinder.js
```
Expected: All tests pass with ✅ marks

## 🚀 Deployment Steps

### Step 1: Install Dependencies
```bash
cd lagacy-server
npm install
```

### Step 2: Configure Environment
```bash
# Verify .env file
cat .env

# Should contain:
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/lagacy-agent
# whoisxml=YOUR_KEY
# hunter=YOUR_KEY
# googlePlaces=YOUR_KEY
```

### Step 3: Start MongoDB
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

### Step 4: Start Server
```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

### Step 5: Verify Deployment
```bash
# Check server logs
# Should see:
# - Server running on port 5000
# - MongoDB connected successfully
```

## 📊 Post-Deployment Verification

### 1. API Endpoints
- [ ] GET /api/health → Returns 200 OK
- [ ] POST /api/scan → Accepts location and returns results
- [ ] GET /api/download → Downloads Excel file

### 2. Database
- [ ] MongoDB connection stable
- [ ] Business documents being saved
- [ ] Query: `db.businesses.countDocuments({ isLegacy: true })`

### 3. External APIs
- [ ] Google Places API responding
- [ ] WhoisXML API responding
- [ ] Hunter.io API responding

### 4. Logging
- [ ] Console logs showing progress
- [ ] Error logs capturing failures
- [ ] Success logs confirming operations

## 🔍 Monitoring

### Key Metrics to Track
1. **API Response Times**
   - Discovery Agent: ~2-5 seconds
   - Domain Age Agent: ~1-2 seconds per domain
   - Contact Finder: ~1-2 seconds per domain

2. **Success Rates**
   - Businesses found: Track count
   - Domains with age data: Track percentage
   - Emails found: Track percentage

3. **Error Rates**
   - API failures: Should be < 5%
   - Retry success: Track retry effectiveness

### Log Monitoring
```bash
# Watch logs in real-time
tail -f server.log

# Search for errors
grep ERROR server.log
```

## ⚠️ Common Issues & Solutions

### Issue 1: MongoDB Connection Failed
**Solution:**
```bash
# Check if MongoDB is running
mongod --version
# Start MongoDB service
net start MongoDB  # Windows
sudo systemctl start mongod  # Linux
```

### Issue 2: API Key Invalid
**Solution:**
- Verify API key in .env file
- Check API provider dashboard for key status
- Ensure no extra spaces in .env file

### Issue 3: No Businesses Found
**Solution:**
- Try different location (more specific or broader)
- Check Google Places API quota
- Verify businessCategory spelling

### Issue 4: Domain Age Not Found
**Solution:**
- Check WhoisXML API credits
- Some domains may not have public WHOIS data
- Verify domain extraction logic

### Issue 5: No Emails Found
**Solution:**
- Check Hunter.io monthly quota
- Some domains may not have discoverable emails
- Verify domain is correct

### Issue 6: Excel Download Fails
**Solution:**
- Ensure at least one legacy business exists in DB
- Check exceljs package is installed
- Verify file write permissions

## 🔒 Security Checklist

- [ ] API keys not committed to git
- [ ] .env file in .gitignore
- [ ] CORS configured properly
- [ ] Input validation on all endpoints
- [ ] Error messages don't expose sensitive data
- [ ] MongoDB connection string secure

## 📈 Performance Optimization

### Current Performance
- 10 businesses: ~1-2 minutes
- 20 businesses: ~3-4 minutes
- 50 businesses: ~8-10 minutes

### Optimization Tips
1. Increase rate limit delays if hitting API quotas
2. Implement caching for domain age lookups
3. Use parallel processing for independent operations
4. Add database indexes for faster queries

## 🎯 Success Criteria

✅ Server starts without errors
✅ All API endpoints respond correctly
✅ MongoDB connection stable
✅ External APIs responding
✅ Scan completes successfully
✅ Excel export works
✅ Logs show progress clearly
✅ Error handling works gracefully

## 📞 Support Resources

- **Documentation**: LEGACY_FINDER_README.md
- **Quick Start**: QUICKSTART.md
- **Architecture**: ARCHITECTURE.md
- **Test Script**: testLegacyFinder.js
- **Postman Collection**: Legacy_Finder_Postman_Collection.json

## 🎉 Ready for Production!

Once all checklist items are complete, your Legacy Website Finder is ready to discover and analyze legacy websites for outreach campaigns.

### Next Steps:
1. Run first production scan
2. Monitor logs and performance
3. Adjust rate limits if needed
4. Scale based on usage patterns
