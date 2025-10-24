# Using Mock Data for Testing

If you want to test the system without setting up Google Places API, follow these steps:

## Quick Switch to Mock Data

### Option 1: Temporary Change
In `src/routes/scanRoute.js`, change line 2:

**FROM:**
```javascript
const { findBusinesses } = require('../agents/discoveryAgent');
```

**TO:**
```javascript
const { findBusinesses } = require('../agents/discoveryAgent.mock');
```

### Option 2: Environment Variable (Better)
Add to `.env`:
```env
USE_MOCK_DATA=true
```

Then update `src/routes/scanRoute.js` line 2:
```javascript
const useMock = process.env.USE_MOCK_DATA === 'true';
const { findBusinesses } = require(useMock ? '../agents/discoveryAgent.mock' : '../agents/discoveryAgent');
```

## Test with Mock Data
```bash
npm start
node quick-test.js
```

You'll see: "Using MOCK data for testing" in the logs.

## Switch Back to Real API
Remove the change or set `USE_MOCK_DATA=false` in `.env`
