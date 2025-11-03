const NewDomainSearch = require('../models/NewDomainSearch');
const NewDomain = require('../models/NewDomain');
const whoisService = require('../services/whoisService');

exports.scanNewDomains = async (req, res) => {
  try {
    const { keywords, tlds, daysBack = 7, leads = 100 } = req.body;
    const userId = req.user._id;

    if (!keywords || !tlds || tlds.length === 0) {
      return res.status(400).json({ success: false, message: 'Keywords and at least one TLD are required' });
    }

    const search = await NewDomainSearch.create({ userId, keywords, tlds, daysBack, leads, status: 'processing' });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const allDomains = [];
    const keywordArray = keywords.split(' ').filter(k => k.trim());

    for (const tld of tlds) {
      try {
        const domains = await whoisService.findNewlyRegisteredDomains({
          keywords: keywordArray,
          tld,
          startDate,
          endDate,
          limit: Math.ceil(leads / tlds.length)
        });

        for (const domain of domains) {
          try {
            const whoisData = await whoisService.getWhoisData(domain.name);
            
            const savedDomain = await NewDomain.create({
              searchId: search._id,
              userId,
              domainName: domain.name,
              registrationDate: domain.registrationDate || new Date(),
              tld,
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

    search.resultsCount = allDomains.length;
    search.status = 'completed';
    await search.save();

    res.json({
      success: true,
      message: `Found ${allDomains.length} newly registered domains`,
      count: allDomains.length,
      searchId: search._id,
      data: allDomains
    });
  } catch (error) {
    console.error('New domain scan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Scan failed' });
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
    res.json({ success: true, search, results });
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
