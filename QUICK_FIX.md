# 🔧 Quick Fix for REQUEST_DENIED Error

## ✅ **Instant Solution: Use Mock Data**

I've already configured your system to use mock data. Just restart:

```bash
npm start
node quick-test.js
```

Your `.env` now has:
```env
USE_MOCK_DATA=true
```

This bypasses Google Places API and uses test data.

---

## 🎯 **What You'll See**

```
[INFO] Using MOCK data for testing
[SUCCESS] Found 3 businesses (MOCK DATA)
```

The system will test:
- ✅ Discovery Agent (mock data)
- ✅ Domain Age Agent (real WhoisXML API)
- ✅ Filter Agent (real filtering)
- ✅ Contact Finder Agent (real Hunter.io API)
- ✅ MongoDB Storage (real database)
- ✅ Excel Export (real file)

---

## 🔄 **To Use Real Google Places API Later**

### Step 1: Enable Places API
1. Go to: https://console.cloud.google.com/
2. Enable "Places API"
3. Create API key
4. Enable billing (required by Google, but $200/month free)

### Step 2: Update .env
```env
googlePlaces=YOUR_NEW_API_KEY
USE_MOCK_DATA=false
```

### Step 3: Restart
```bash
npm start
```

---

## 🧪 **Test Now**

```bash
# Start server
npm start

# Run test
node quick-test.js
```

**Expected output:**
```
✅ Health: { status: 'OK', message: 'Server is running' }
✅ Scan Result:
   - Found: 3 legacy websites
   - Message: Scan complete
✅ Download successful!
```

---

## 📝 **Note**

Mock data includes 3 sample businesses with real-looking websites. The rest of the pipeline (domain age check, email finding, database storage, Excel export) works with real APIs and services.

This lets you test the entire system immediately! 🚀
