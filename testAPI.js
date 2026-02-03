/**
 * API Test Script
 * Run this to verify your backend API is working correctly
 * Usage: node testAPI.js
 */

const API_BASE = 'http://localhost:5000/api';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, url, options = {}) {
  try {
    log(`\nTesting: ${name}`, 'blue');
    log(`URL: ${url}`, 'yellow');
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (response.ok) {
      log('✓ SUCCESS', 'green');
      log(`Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`, 'reset');
      return { success: true, data };
    } else {
      log('✗ FAILED', 'red');
      log(`Error: ${JSON.stringify(data)}`, 'red');
      return { success: false, error: data };
    }
  } catch (error) {
    log('✗ ERROR', 'red');
    log(`Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n========================================', 'blue');
  log('   LAGACY API Test Suite', 'blue');
  log('========================================\n', 'blue');

  let passed = 0;
  let failed = 0;

  // Test 1: Health Check
  const health = await testEndpoint(
    'Health Check',
    `${API_BASE}/health`
  );
  health.success ? passed++ : failed++;

  // Test 2: Get Settings
  const settings = await testEndpoint(
    'Get Settings',
    `${API_BASE}/settings`
  );
  settings.success ? passed++ : failed++;

  // Test 3: Get Recent Searches
  const searches = await testEndpoint(
    'Get Recent Searches',
    `${API_BASE}/searches/recent?limit=5`
  );
  searches.success ? passed++ : failed++;

  // Test 4: Get All Searches
  const allSearches = await testEndpoint(
    'Get All Searches',
    `${API_BASE}/searches`
  );
  allSearches.success ? passed++ : failed++;

  // Test 5: Get All Leads
  const leads = await testEndpoint(
    'Get All Leads',
    `${API_BASE}/leads?limit=10`
  );
  leads.success ? passed++ : failed++;

  // Test 6: Create a Test Search
  const newSearch = await testEndpoint(
    'Create Test Search',
    `${API_BASE}/searches`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'test-search-' + Date.now(),
        searchType: 'domain',
        apiUsed: 'whoisxml',
        status: 'pending'
      })
    }
  );
  newSearch.success ? passed++ : failed++;

  // Test 7: Update Settings (API Keys)
  const updateSettings = await testEndpoint(
    'Update API Keys',
    `${API_BASE}/settings/api-keys`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        whoisxml: 'test-key-123',
        hunter: 'test-key-456',
        googlePlaces: 'test-key-789'
      })
    }
  );
  updateSettings.success ? passed++ : failed++;

  // Test 8: Create a Test Lead
  if (newSearch.success && newSearch.data.data) {
    const newLead = await testEndpoint(
      'Create Test Lead',
      `${API_BASE}/leads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          phone: '+1-555-0000',
          company: 'Test Company',
          source: 'manual',
          status: 'new',
          searchId: newSearch.data.data._id
        })
      }
    );
    newLead.success ? passed++ : failed++;

    // Test 9: Get Leads by Search ID
    const searchLeads = await testEndpoint(
      'Get Leads by Search ID',
      `${API_BASE}/leads/search/${newSearch.data.data._id}`
    );
    searchLeads.success ? passed++ : failed++;
  } else {
    log('\nSkipping lead tests (search creation failed)', 'yellow');
    failed += 2;
  }

  // Summary
  log('\n========================================', 'blue');
  log('   Test Summary', 'blue');
  log('========================================', 'blue');
  log(`Total Tests: ${passed + failed}`, 'reset');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
  log('========================================\n', 'blue');

  if (failed === 0) {
    log('🎉 All tests passed! Your API is working correctly.', 'green');
  } else {
    log('⚠️  Some tests failed. Check the errors above.', 'yellow');
  }

  process.exit(failed === 0 ? 0 : 1);
}

// Check if server is running before tests
async function checkServer() {
  try {
    log('Checking if server is running...', 'yellow');
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      log('✓ Server is running!', 'green');
      return true;
    }
  } catch (error) {
    log('✗ Server is not responding!', 'red');
    log('Make sure the server is running with: npm run dev', 'yellow');
    return false;
  }
  return false;
}

// Run the test suite
checkServer().then(isRunning => {
  if (isRunning) {
    runTests();
  } else {
    process.exit(1);
  }
});
