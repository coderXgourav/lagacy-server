const NewDomainSearch = require('../models/NewDomainSearch');
const NewDomain = require('../models/NewDomain');
const whoisService = require('../services/whoisService');
const ctService = require('../services/certificateTransparencyService');

exports.scanNewDomains = async (req, res) => {
  let search;
  try {
    const { keywords, tlds, daysBack = 7, leads = 100 } = req.body;
    const userId = req.user._id;

    if (!tlds || tlds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one TLD is required' });
    }

    search = await NewDomainSearch.create({ userId, keywords: keywords || '', tlds, daysBack, leads, status: 'processing' });

    req.on('close', async () => {
      if (!res.headersSent && search && search.status === 'processing') {
        console.log('⚠️ Client disconnected, marking search as cancelled');
        search.status = 'cancelled';
        search.completedAt = new Date();
        await search.save();
      }
    });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const allDomains = [];
    const keywordArray = keywords ? keywords.split(' ').filter(k => k.trim()) : [];

    // Check if cancelled
    let freshSearch = await NewDomainSearch.findById(search._id);
    if (freshSearch.cancelRequested) {
      search.status = 'cancelled';
      search.completedAt = new Date();
      await search.save();
      console.log(`🚫 Search cancelled before processing`);
      return;
    }

    // Try Certificate Transparency first (free)
    try {
      console.log('🔍 Searching Certificate Transparency logs...');
      const ctDomains = await ctService.findNewDomainsFromCTOptimized({
        keywords: keywordArray,
        daysBack,
        limit: Math.ceil(leads * 0.7),
        tlds: tlds
      });

      console.log(`CT found ${ctDomains.length} domains, processing...`);
      
      for (const domain of ctDomains) {
        try {
          const domainTld = domain.name.split('.').pop();
          console.log(`Processing domain: ${domain.name}, TLD: ${domainTld}, Allowed TLDs: ${tlds}`);
          
          // Accept all domains from CT search since we're already filtering by TLD

          const savedDomain = await NewDomain.create({
            searchId: search._id,
            userId,
            domainName: domain.name,
            registrationDate: domain.registrationDate,
            tld: domainTld,
            source: 'certificate_transparency',
            registrant: {},
            nameservers: [],
            status: 'active'
          });

          allDomains.push(savedDomain);
          console.log(`Saved domain: ${domain.name}`);
          if (allDomains.length >= leads) break;
        } catch (error) {
          console.error(`Error saving CT domain ${domain.name}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Certificate Transparency search failed:', error.message);
    }

    // If we still need more domains, try WHOIS service
    if (allDomains.length < leads) {
      console.log(`🔍 Searching WHOIS databases for additional domains... (Current count: ${allDomains.length})`);
      const remainingLeads = leads - allDomains.length;
      
      for (const tld of tlds) {
        try {
          const domains = await whoisService.findNewlyRegisteredDomains({
            keywords: keywordArray,
            tld,
            startDate,
            endDate,
            limit: Math.ceil(remainingLeads / tlds.length)
          });

          for (const domain of domains) {
            try {
              // Skip if we already have this domain from CT
              const existingDomain = allDomains.find(d => d.domainName === domain.name);
              if (existingDomain) continue;

              const whoisData = await whoisService.getWhoisData(domain.name);
              
              const savedDomain = await NewDomain.create({
                searchId: search._id,
                userId,
                domainName: domain.name,
                registrationDate: domain.registrationDate || new Date(),
                tld,
                source: 'whois',
                registrant: whoisData?.registrant || {},
                nameservers: whoisData?.nameservers || [],
                status: whoisData?.status || 'active'
              });

              allDomains.push(savedDomain);
              if (allDomains.length >= leads) break;
            } catch (error) {
              console.error(`Error enriching domain ${domain.name}:`, error.message);
            }
          }

          if (allDomains.length >= leads) break;
        } catch (error) {
          console.error(`Error searching TLD ${tld}:`, error.message);
        }
      }
    }

    search.resultsCount = allDomains.length;
    search.status = 'completed';
    search.completedAt = new Date();
    await search.save();

    console.log(`Final result: ${allDomains.length} domains saved to database`);
    
    res.json({
      success: true,
      message: `Found ${allDomains.length} newly registered domains`,
      count: allDomains.length,
      searchId: search._id,
      data: allDomains
    });
  } catch (error) {
    console.error('New domain scan error:', error);
    if (search) {
      search.status = 'failed';
      search.completedAt = new Date();
      await search.save();
    }
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Scan failed' });
    }
  }
};

exports.getRecentSearches = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;

    const searches = await NewDomainSearch.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, searches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSearchResults = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const search = await NewDomainSearch.findOne({ _id: id, userId });
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }

    const results = await NewDomain.find({ searchId: id, userId });
    res.json({ 
      success: true, 
      data: {
        search: {
          id: search._id,
          keywords: search.keywords,
          tlds: search.tlds,
          executedAt: search.executedAt,
          resultsCount: search.resultsCount,
          status: search.status
        },
        results
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelSearch = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const search = await NewDomainSearch.findOne({ _id: id, userId });
    
    if (!search) return res.status(404).json({ success: false, message: 'Search not found' });
    if (search.status === 'completed' || search.status === 'failed') {
      return res.json({ success: false, message: 'Search already completed' });
    }
    
    search.cancelRequested = true;
    if (search.status === 'pending') {
      search.status = 'cancelled';
      search.completedAt = new Date();
    }
    await search.save();
    
    console.log(`🚫 Cancellation requested for search ${search._id}`);
    res.json({ success: true, message: 'Cancellation requested' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSearch = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const search = await NewDomainSearch.findOneAndDelete({ _id: id, userId });
    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }

    await NewDomain.deleteMany({ searchId: id, userId });
    res.json({ success: true, message: 'Search deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
