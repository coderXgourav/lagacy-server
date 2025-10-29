const axios = require('axios');
const Settings = require('../models/Settings');

async function findBusinessPage({ name, phone, address }) {
  try {
    const settings = await Settings.findOne();
    let accessToken = settings?.apiKeys?.facebook || process.env.FACEBOOK_ACCESS_TOKEN;
    if (accessToken) accessToken = accessToken.replace(/["']/g, '').trim();
    
    if (!accessToken) {
      console.log('No Facebook API key configured');
      return null;
    }
    
    const searchUrl = `https://graph.facebook.com/v18.0/pages/search`;
    
    const response = await axios.get(searchUrl, {
      params: {
        q: name,
        type: 'place',
        fields: 'id,name,link,emails,phone',
        access_token: accessToken
      }
    });

    if (!response.data.data || response.data.data.length === 0) {
      return null;
    }

    const page = response.data.data[0];
    
    try {
      const pageDetails = await getPageDetails(page.id, accessToken);
      
      return {
        pageUrl: page.link || `https://facebook.com/${page.id}`,
        email: pageDetails.emails?.[0] || page.emails?.[0],
        ownerName: pageDetails.owner?.name || null,
        phone: page.phone || null
      };
    } catch (error) {
      return {
        pageUrl: page.link || `https://facebook.com/${page.id}`,
        email: page.emails?.[0],
        ownerName: null,
        phone: page.phone || null
      };
    }

  } catch (error) {
    console.error('Facebook API error:', error.response?.data || error.message);
    return null;
  }
}

async function getPageDetails(pageId, accessToken) {
  const url = `https://graph.facebook.com/v18.0/${pageId}`;
  const response = await axios.get(url, {
    params: {
      fields: 'emails,owner,phone,about',
      access_token: accessToken
    }
  });
  
  return response.data;
}

module.exports = { findBusinessPage };
