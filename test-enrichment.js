const domainEnrichmentService = require('./services/domainEnrichmentService');
const Settings = require('./models/Settings');
require('./config/database');

async function testEnrichment() {
  console.log('🧪 Testing Domain Enrichment...\n');

  const testDomains = ['google.com', 'github.com', 'amazon.com'];

  for (const domain of testDomains) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${domain}`);
    console.log('='.repeat(60));

    // Test RDAP
    console.log('\n📡 Testing RDAP...');
    const rdapData = await domainEnrichmentService.enrichWithRDAP(domain);
    console.log('RDAP Result:', JSON.stringify(rdapData, null, 2));

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test WhoisFreaks
    console.log('\n📡 Testing WhoisFreaks...');
    const settings = await Settings.findOne();
    const whoisFreaksKey = settings?.apiKeys?.whoisfreaks;
    
    if (whoisFreaksKey) {
      const whoisData = await domainEnrichmentService.enrichWithWhoisFreaks(domain, whoisFreaksKey);
      console.log('WhoisFreaks Result:', JSON.stringify(whoisData, null, 2));
    } else {
      console.log('⚠️ WhoisFreaks API key not configured');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Testing complete!');
  process.exit(0);
}

testEnrichment().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
