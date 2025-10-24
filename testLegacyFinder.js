const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testScan() {
  console.log('🔍 Testing Legacy Website Finder...\n');

  try {
    console.log('1️⃣ Testing POST /api/scan endpoint...');
    const scanResponse = await axios.post(`${BASE_URL}/api/scan`, {
      location: 'Kolkata, West Bengal, India',
      businessCategory: 'restaurants'
    });

    console.log('✅ Scan completed successfully!');
    console.log(`   Found ${scanResponse.data.count} legacy websites`);
    console.log(`   Message: ${scanResponse.data.message}\n`);

    if (scanResponse.data.count > 0) {
      console.log('   Sample result:');
      console.log(`   - Business: ${scanResponse.data.data[0].businessName}`);
      console.log(`   - Website: ${scanResponse.data.data[0].website}`);
      console.log(`   - Created: ${scanResponse.data.data[0].domainCreationDate}`);
      console.log(`   - Emails: ${scanResponse.data.data[0].emails.join(', ') || 'None found'}\n`);
    }

    console.log('2️⃣ Testing GET /api/download endpoint...');
    const downloadResponse = await axios.get(`${BASE_URL}/api/download`, {
      responseType: 'arraybuffer'
    });

    console.log('✅ Excel export successful!');
    console.log(`   File size: ${downloadResponse.data.byteLength} bytes`);
    console.log(`   Content-Type: ${downloadResponse.headers['content-type']}\n`);

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run tests
testScan();
