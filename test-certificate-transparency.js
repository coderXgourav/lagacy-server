const ctService = require('./services/certificateTransparencyService');

async function testCertificateTransparency() {
  console.log('🔍 Testing Certificate Transparency Integration...\n');
  
  try {
    console.log('📊 Test 1: General new domains (last 1 day)');
    const generalDomains = await ctService.findNewDomainsFromCTOptimized({
      keywords: ['shop', 'app'],
      daysBack: 1,
      limit: 10
    });
    
    console.log(`✅ Found ${generalDomains.length} new domains\n`);
    
    generalDomains.slice(0, 5).forEach((domain, index) => {
      console.log(`${index + 1}. ${domain.name}`);
      console.log(`   Registration: ${domain.registrationDate.toISOString().split('T')[0]}`);
      console.log(`   Source: ${domain.source}`);
      console.log(`   Certificate ID: ${domain.certificateId}\n`);
    });
    
    console.log('📊 Test 2: Keyword-specific search');
    const keywordDomains = await ctService.findNewDomainsFromCTOptimized({
      keywords: ['tech', 'digital'],
      daysBack: 2,
      limit: 5
    });
    
    console.log(`✅ Found ${keywordDomains.length} tech/digital domains\n`);
    
    keywordDomains.forEach((domain, index) => {
      console.log(`${index + 1}. ${domain.name}`);
      console.log(`   Registration: ${domain.registrationDate.toISOString().split('T')[0]}\n`);
    });
    
    console.log('🎯 Certificate Transparency integration is working!');
    console.log('💡 This provides FREE new domain discovery as an alternative to paid APIs');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCertificateTransparency();