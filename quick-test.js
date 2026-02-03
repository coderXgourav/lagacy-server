const axios = require('axios');

async function quickTest() {
  console.log('🧪 Quick Test - Legacy Website Finder\n');

  // Test 1: Health Check
  try {
    console.log('1️⃣ Testing Health...');
    const health = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Health:', health.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Scan (small test)
  try {
    console.log('\n2️⃣ Testing Scan (this may take 1-2 minutes)...');
    const scan = await axios.post('http://localhost:5000/api/scan', {
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      radius: 5000,
      businessCategory: 'restaurants',
      leadCap: 10
    });
    console.log('✅ Scan Result:');
    console.log(`   - Found: ${scan.data.count} legacy websites`);
    console.log(`   - Message: ${scan.data.message}`);
    if (scan.data.count > 0) {
      console.log(`   - Sample: ${scan.data.data[0].businessName}`);
    }
  } catch (error) {
    console.log('❌ Scan failed:', error.response?.data || error.message);
    return;
  }

  // Test 3: Download
  try {
    console.log('\n3️⃣ Testing Download...');
    const download = await axios.get('http://localhost:5000/api/download', {
      responseType: 'arraybuffer'
    });
    console.log('✅ Download successful!');
    console.log(`   - File size: ${download.data.byteLength} bytes`);
  } catch (error) {
    console.log('❌ Download failed:', error.response?.data || error.message);
  }

  console.log('\n🎉 Testing complete!');
}

quickTest();
