const mongoose = require('mongoose');
require('dotenv').config();

const Settings = require('./models/Settings');

async function checkApiKeys() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const settings = await Settings.findOne();
    
    if (!settings) {
      console.log('\n❌ No settings found in database');
      console.log('Please save API keys through the Settings page first\n');
    } else {
      console.log('\n✅ Settings found:');
      console.log('Google Places API Key:', settings.apiKeys?.googlePlaces || '(empty)');
      console.log('Foursquare API Key:', settings.apiKeys?.foursquare || '(empty)');
      console.log('Hunter API Key:', settings.apiKeys?.hunter || '(empty)');
      console.log('WhoisFreaks API Key:', settings.apiKeys?.whoisfreaks || '(empty)');
      console.log('');
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkApiKeys();
