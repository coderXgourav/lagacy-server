const yelpService = require('./services/yelpLowRatingService');

async function testYelpLowRating() {
  console.log('🔍 Testing Yelp Low-Rating Business Search...\n');
  
  try {
    const results = await yelpService.findLowRatedBusinesses({
      city: 'San Francisco',
      state: 'CA',
      country: 'United States',
      radius: 5000,
      category: 'restaurants',
      maxRating: 3.0,
      limit: 10
    });
    
    console.log(`✅ Found ${results.length} low-rated businesses on Yelp\n`);
    
    results.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name}`);
      console.log(`   Rating: ${business.rating}/5 (${business.totalReviews} reviews)`);
      console.log(`   Address: ${business.address}`);
      console.log(`   Phone: ${business.phone}`);
      console.log(`   Yelp: ${business.yelpUrl}`);
      console.log(`   Category: ${business.category}\n`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testYelpLowRating();