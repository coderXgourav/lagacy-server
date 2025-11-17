const domainEnrichmentService = require('./services/domainEnrichmentService');

/**
 * Test script for parallel RDAP enrichment grouped by TLD
 * This demonstrates how domains are grouped by TLD and processed in parallel
 */

async function testParallelEnrichment() {
  console.log('🧪 Testing Parallel RDAP Enrichment with Rate Limit Handling\n');

  // Test domains with different TLDs
  const testDomains = [
    'example1.com',
    'example2.com',
    'example3.com',
    'test1.net',
    'test2.net',
    'demo1.org',
    'demo2.org',
    'demo3.org',
    'sample.io',
    'website.co'
  ];

  console.log(`📝 Testing with ${testDomains.length} domains across multiple TLDs`);
  console.log(`🛡️  Features: Automatic fallback servers, rate limit tracking, adaptive delays\n`);

  try {
    const startTime = Date.now();

    // Run parallel enrichment with rate limit handling
    const results = await domainEnrichmentService.enrichDomainsInParallel(testDomains, {
      concurrentPerTLD: 3,           // Process 3 domains per TLD concurrently
      delayBetweenBatches: 1000,     // 1 second delay between batches
      maxRetriesPerDomain: 2,        // 2 retries per domain before fallback
      enableProgressTracking: true   // Show real-time progress
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n⏱️  Total time: ${duration} seconds`);
    console.log(`\n📊 Results Summary:`);
    console.log(`${'='.repeat(80)}`);

    let successCount = 0;
    let failureCount = 0;

    for (const [domainName, result] of results) {
      if (result.success) {
        successCount++;
        const hasEmail = result.data?.registrant?.email ? '✉️' : '❌';
        const hasPhone = result.data?.registrant?.phone ? '📞' : '❌';
        console.log(`✅ ${domainName}`);
        console.log(`   Email: ${hasEmail} | Phone: ${hasPhone}`);
        if (result.data?.registrant?.email) {
          console.log(`   📧 ${result.data.registrant.email}`);
        }
      } else {
        failureCount++;
        console.log(`❌ ${domainName} - Failed`);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Success: ${successCount}/${testDomains.length} (${((successCount/testDomains.length)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failureCount}/${testDomains.length}`);
    console.log(`⚡ Average time per domain: ${(duration / testDomains.length).toFixed(2)}s`);
    
    // Show rate limit status after test
    console.log(`\n🔍 Rate Limit Status After Test:`);
    const rateLimitStatus = domainEnrichmentService.getRateLimitStatus();
    if (rateLimitStatus.totalRateLimited > 0) {
      console.log(`⚠️  ${rateLimitStatus.totalRateLimited} servers are rate limited:`);
      rateLimitStatus.servers.forEach(s => {
        console.log(`   - ${s.server}: ${s.remainingCooldown}s cooldown remaining`);
      });
    } else {
      console.log(`✅ No servers are currently rate limited`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testParallelEnrichment().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test error:', error);
  process.exit(1);
});
