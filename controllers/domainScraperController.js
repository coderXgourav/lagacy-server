const domainScraperService = require('../services/domainScraperService');
const ScrapedDomain = require('../models/ScrapedDomain');

exports.getDashboardStats = async (req, res) => {
  try {
    const totalDomains = await ScrapedDomain.countDocuments();
    
    const dateStats = await ScrapedDomain.aggregate([
      { $group: { _id: '$sourceDate', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    res.json({
      success: true,
      totalDomains,
      dateStats: dateStats.map(d => ({ date: d._id, count: d.count }))
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.triggerScrape = async (req, res) => {
  try {
    const status = domainScraperService.getStatus();
    
    if (status.isRunning) {
      return res.status(400).json({
        success: false,
        message: 'Scraping already in progress'
      });
    }

    domainScraperService.scrapeNewDomains()
      .then(results => {
        console.log('✅ Scraping completed:', results);
      })
      .catch(error => {
        console.error('❌ Scraping failed:', error);
      });

    res.json({
      success: true,
      message: 'Scraping started in background'
    });
  } catch (error) {
    console.error('Trigger scrape error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getAllDomains = async (req, res) => {
  try {
    const { page = 1, limit = 50, date } = req.query;
    
    const query = date ? { sourceDate: date } : {};
    
    const domains = await ScrapedDomain.find(query)
      .sort({ scrapedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ScrapedDomain.countDocuments(query);

    res.json({
      success: true,
      domains,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get domains error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const status = domainScraperService.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
