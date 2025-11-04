const Settings = require('./models/Settings');
require('./config/database');

async function checkSettings() {
  console.log('🔍 Checking Settings...\n');

  const settings = await Settings.findOne();
  
  if (!settings) {
    console.log('❌ No settings document found in database');
    console.log('\n💡 Creating default settings...');
    const newSettings = await Settings.create({
      apiKeys: {
        whoisfreaks: '',
        whoisxml: '',
        hunter: '',
        googlePlaces: '',
        foursquare: '',
        facebook: '',
        yelp: ''
      }
    });
    console.log('✅ Default settings created');
    console.log('\n⚠️ Please add your WhoisFreaks API key via the settings page');
  } else {
    console.log('✅ Settings document found');
    console.log('\n📋 API Keys:');
    console.log('  WhoisFreaks:', settings.apiKeys?.whoisfreaks ? `${settings.apiKeys.whoisfreaks.substring(0, 10)}...` : '❌ Not set');
    console.log('  WhoisXML:', settings.apiKeys?.whoisxml ? `${settings.apiKeys.whoisxml.substring(0, 10)}...` : '❌ Not set');
    console.log('  Hunter:', settings.apiKeys?.hunter ? `${settings.apiKeys.hunter.substring(0, 10)}...` : '❌ Not set');
    console.log('  Google Places:', settings.apiKeys?.googlePlaces ? `${settings.apiKeys.googlePlaces.substring(0, 10)}...` : '❌ Not set');
    console.log('  Foursquare:', settings.apiKeys?.foursquare ? `${settings.apiKeys.foursquare.substring(0, 10)}...` : '❌ Not set');
    console.log('  Facebook:', settings.apiKeys?.facebook ? `${settings.apiKeys.facebook.substring(0, 10)}...` : '❌ Not set');
    console.log('  Yelp:', settings.apiKeys?.yelp ? `${settings.apiKeys.yelp.substring(0, 10)}...` : '❌ Not set');
    
    if (!settings.apiKeys?.whoisfreaks) {
      console.log('\n⚠️ WhoisFreaks API key is not configured!');
      console.log('💡 Add it via: Settings page or MongoDB directly');
    }
  }

  process.exit(0);
}

checkSettings().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
