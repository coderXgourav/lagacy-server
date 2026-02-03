const axios = require('axios');

/**
 * Search Service - Integrates with multiple APIs to find leads
 */

class SearchService {
  constructor(apiKeys) {
    this.apiKeys = apiKeys;
  }

  /**
   * Search for businesses using Google Places API
   */
  async searchGooglePlaces(city, state, country, radius, category) {
    try {
      if (!this.apiKeys.googlePlaces) {
        throw new Error('Google Places API key not configured');
      }

      const location = `${city}, ${state}, ${country}`;
      
      // First, geocode the location
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${this.apiKeys.googlePlaces}`;
      const geocodeResponse = await axios.get(geocodeUrl);
      
      if (!geocodeResponse.data.results || geocodeResponse.data.results.length === 0) {
        throw new Error('Location not found');
      }

      const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
      
      // Search for places
      const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius * 1000}&type=${category}&key=${this.apiKeys.googlePlaces}`;
      const placesResponse = await axios.get(placesUrl);
      
      const businesses = placesResponse.data.results || [];
      
      // Get detailed information for each place
      const detailedBusinesses = [];
      for (const business of businesses.slice(0, 20)) { // Limit to 20 to avoid quota issues
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${business.place_id}&fields=name,formatted_address,formatted_phone_number,website,types&key=${this.apiKeys.googlePlaces}`;
          const detailsResponse = await axios.get(detailsUrl);
          
          if (detailsResponse.data.result) {
            detailedBusinesses.push({
              name: detailsResponse.data.result.name,
              address: detailsResponse.data.result.formatted_address,
              phone: detailsResponse.data.result.formatted_phone_number || '',
              website: detailsResponse.data.result.website || '',
              category: detailsResponse.data.result.types?.[0] || category,
              source: 'google'
            });
          }
        } catch (err) {
          console.error('Error fetching place details:', err.message);
        }
      }
      
      return detailedBusinesses;
    } catch (error) {
      console.error('Google Places API Error:', error.message);
      throw error;
    }
  }

  /**
   * Get WHOIS information for a domain
   */
  async getWhoisInfo(domain) {
    try {
      if (!this.apiKeys.whoisxml) {
        return null;
      }

      const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      
      const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${this.apiKeys.whoisxml}&domainName=${cleanDomain}&outputFormat=JSON`;
      const response = await axios.get(url);
      
      if (response.data && response.data.WhoisRecord) {
        const whoisData = response.data.WhoisRecord;
        const createdDate = whoisData.createdDate || whoisData.registryData?.createdDate;
        
        return {
          domain: cleanDomain,
          createdDate: createdDate,
          registrar: whoisData.registrarName,
          isOldDomain: createdDate ? new Date(createdDate).getFullYear() < 2020 : false
        };
      }
      
      return null;
    } catch (error) {
      console.error('WHOIS API Error:', error.message);
      return null;
    }
  }

  /**
   * Find email using Hunter.io
   */
  async findEmail(domain, companyName) {
    try {
      if (!this.apiKeys.hunter) {
        return null;
      }

      const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      
      // Domain search to find emails
      const url = `https://api.hunter.io/v2/domain-search?domain=${cleanDomain}&api_key=${this.apiKeys.hunter}&limit=5`;
      const response = await axios.get(url);
      
      if (response.data && response.data.data && response.data.data.emails) {
        const emails = response.data.data.emails;
        
        // Prefer generic emails or first available
        const genericEmail = emails.find(e => 
          e.type === 'generic' || 
          e.value.includes('info') || 
          e.value.includes('contact') ||
          e.value.includes('hello')
        );
        
        return genericEmail ? genericEmail.value : (emails[0]?.value || null);
      }
      
      return null;
    } catch (error) {
      console.error('Hunter.io API Error:', error.message);
      return null;
    }
  }

  /**
   * Extract domain from website URL
   */
  extractDomain(url) {
    if (!url) return null;
    try {
      const domain = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      return domain;
    } catch (error) {
      return null;
    }
  }

  /**
   * Main search function - orchestrates all API calls
   */
  async executeSearch(searchParams) {
    const { city, state, country, radius, category } = searchParams;
    const leads = [];
    
    try {
      // Step 1: Get businesses from Google Places
      console.log('Searching Google Places...');
      const businesses = await this.searchGooglePlaces(city, state, country, radius, category);
      console.log(`Found ${businesses.length} businesses from Google Places`);
      
      // Step 2: Enrich each business with WHOIS and email data
      for (const business of businesses) {
        try {
          const domain = this.extractDomain(business.website);
          
          let whoisInfo = null;
          let email = null;
          
          // Get WHOIS info if domain exists
          if (domain) {
            console.log(`Checking WHOIS for ${domain}...`);
            whoisInfo = await this.getWhoisInfo(domain);
            
            // Only proceed if domain was registered before 2020
            if (whoisInfo && !whoisInfo.isOldDomain) {
              console.log(`Skipping ${domain} - registered after 2020`);
              continue;
            }
            
            // Find email for this domain
            console.log(`Finding email for ${domain}...`);
            email = await this.findEmail(domain, business.name);
          }
          
          // Create lead object
          const lead = {
            name: business.name,
            email: email || '',
            phone: business.phone || '',
            company: business.name,
            website: business.website || '',
            address: business.address || '',
            city: city,
            state: state,
            country: country,
            category: business.category,
            source: business.source,
            domainAge: whoisInfo?.createdDate ? new Date(whoisInfo.createdDate).getFullYear() : null,
            registrar: whoisInfo?.registrar || '',
            status: 'new'
          };
          
          leads.push(lead);
          
          // Add small delay to avoid rate limiting
          await this.sleep(500);
          
        } catch (err) {
          console.error(`Error processing business ${business.name}:`, err.message);
        }
      }
      
      console.log(`Successfully processed ${leads.length} leads`);
      return leads;
      
    } catch (error) {
      console.error('Search execution error:', error);
      throw error;
    }
  }

  /**
   * Helper function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SearchService;
