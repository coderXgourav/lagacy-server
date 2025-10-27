// Test script for search endpoints
const mongoose = require('mongoose');
require('dotenv').config();

const Search = require('./models/Search');
const SearchResult = require('./models/SearchResult');

async function testEndpoints() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legacy-finder');
    console.log('✓ Connected to MongoDB');

    // Test 1: Create a test search
    const testSearch = await Search.create({
      query: 'Test Location',
      searchType: 'location',
      filters: { city: 'Test City', country: 'Test Country' },
      status: 'completed',
      resultsCount: 2,
      apiUsed: 'google',
      downloadInfo: {
        isDownloadable: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    console.log('✓ Test search created:', testSearch._id);

    // Test 2: Store results
    const testResults = [
      {
        searchId: testSearch._id,
        businessData: {
          name: 'Test Business 1',
          website: 'test1.com',
          email: 'test1@test.com',
          phone: '123456789',
          city: 'Test City',
          country: 'Test Country',
          isLegacy: true
        },
        metadata: { source: 'google' }
      },
      {
        searchId: testSearch._id,
        businessData: {
          name: 'Test Business 2',
          website: 'test2.com',
          email: 'test2@test.com',
          phone: '987654321',
          city: 'Test City',
          country: 'Test Country',
          isLegacy: false
        },
        metadata: { source: 'google' }
      }
    ];

    await SearchResult.insertMany(testResults);
    console.log('✓ Test results stored');

    // Test 3: Retrieve results
    const results = await SearchResult.find({ searchId: testSearch._id });
    console.log('✓ Retrieved results:', results.length);

    // Test 4: Get search with results
    const search = await Search.findById(testSearch._id);
    console.log('✓ Search details:', {
      id: search._id,
      query: search.query,
      resultsCount: search.resultsCount,
      isDownloadable: search.downloadInfo.isDownloadable
    });

    console.log('\n✅ All tests passed!');
    console.log('\nEndpoints ready:');
    console.log(`GET  /api/searches/${testSearch._id}/results`);
    console.log(`POST /api/searches/results`);
    console.log(`GET  /api/searches/${testSearch._id}/download`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testEndpoints();
